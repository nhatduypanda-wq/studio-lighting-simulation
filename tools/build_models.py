#!/usr/bin/env python3
"""Build the portrait models from MakeHuman data.

Inputs (not stored in this repository):
  --mh    checkout of github.com/makehumancommunity/makehuman  (base mesh, macro targets; CC0)
  --data  checkout of github.com/makehuman-js/makehuman-data   (the MakeHuman system assets converted
          to JSON: skeleton weights and the hair, eye, eyebrow, eyelash and clothes meshes)
  --pack  unpacked makehuman_system_assets_cc0.zip from files.makehumancommunity.org/asset_packs
          (the same system assets with full-resolution textures; CC0)
Output:
  assets/models/<gender>_<ethnicity>.glb   body + eyes + brows + lashes + hair styles + clothes
  assets/models/tex/*                      textures
  assets/models/meta.json                  eye height, neck pivot etc. per model

For each model the script applies the macro morph targets to the base mesh, lowers the arms
with linear-blend skinning, refits every proxy (hair, clothes, ...) to the new body, removes the
body faces hidden under the clothes and writes a `_TURN` vertex attribute (0..1) that tells the
app how much each vertex follows the head when it turns.

Usage: python3 tools/build_models.py --mh <dir> --data <dir> --pack <dir>
"""
import argparse, json, os, struct
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--mh', required=True)
ap.add_argument('--data', required=True)
ap.add_argument('--pack', required=True)
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'assets', 'models'))
args = ap.parse_args()
TGT = os.path.join(args.mh, 'makehuman', 'data', 'targets')
PUB = os.path.join(args.data, 'public', 'data')
OUT = os.path.abspath(args.out)
os.makedirs(os.path.join(OUT, 'tex'), exist_ok=True)

GENDERS = ['female', 'male']
ETHNIC = {'cau': 'caucasian', 'asi': 'asian', 'afr': 'african'}
AGES = {'young': 0.0, 'old': 0.7}  # weight of the "old" macro targets
HAIR = {'female': ['bob01', 'long01', 'ponytail01', 'short03', 'afro01'],
        'male': ['short02', 'short04', 'short01', 'afro01']}
CLOTHES = {'female': ['female_casualsuit01'], 'male': ['male_casualsuit02']}
ARM_DOWN_DEG = 27.0
SCALE = 0.1  # MakeHuman units are decimetres


def load_three(path):
    """Parse a three.js JSON (format 3) model into vertices, uvs and polygon lists."""
    j = json.load(open(path))
    V = np.array(j['vertices'], dtype=np.float64).reshape(-1, 3)
    UV = np.array(j['uvs'][0], dtype=np.float64).reshape(-1, 2) if j['uvs'] and j['uvs'][0] else np.zeros((0, 2))
    f = j['faces']; i = 0; polys = []
    while i < len(f):
        t = f[i]; i += 1
        n = 4 if t & 1 else 3
        vi = f[i:i + n]; i += n
        mat = 0
        if t & 2: mat = f[i]; i += 1
        if t & 4: i += 1
        uv = None
        if t & 8: uv = f[i:i + n]; i += n
        if t & 16: i += 1
        if t & 32: i += n
        if t & 64: i += 1
        if t & 128: i += n
        polys.append((vi, uv, mat))
    return j, V, UV, polys


def load_target(name):
    idx, d = [], []
    for line in open(os.path.join(TGT, name)):
        p = line.split()
        if len(p) == 4 and not line.startswith('#'):
            idx.append(int(p[0])); d.append([float(p[1]), float(p[2]), float(p[3])])
    return np.array(idx, dtype=int), np.array(d, dtype=np.float64).reshape(-1, 3)


def rot_z(deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


base_json, BASE_V, BASE_UV, BASE_POLYS = load_three(os.path.join(PUB, 'models', 'human_full_size.json'))
NV = len(BASE_V)
BONES = base_json['bones']
BNAME = [b['name'] for b in BONES]
SKIN_I = np.array(base_json['skinIndices']).reshape(-1, 4)
SKIN_W = np.array(base_json['skinWeights']).reshape(-1, 4)
JOINTS = base_json['metadata']['joint_pos_idxs']
BODY_MAT = [m['DbgName'] for m in base_json['materials']].index('body')


def subtree(root_name):
    root = BNAME.index(root_name)
    out = set([root]); changed = True
    while changed:
        changed = False
        for i, b in enumerate(BONES):
            if b['parent'] in out and i not in out: out.add(i); changed = True
    return out


ARM = {'L': subtree('upperarm01.L____head'), 'R': subtree('upperarm01.R____head')}
HEAD = subtree('head____head')
TURN_OF_BONE = np.zeros(len(BONES))
for i in HEAD: TURN_OF_BONE[i] = 1.0
for nm, fr in (('neck03', 0.8), ('neck02', 0.55), ('neck01', 0.3)):
    for suffix in ('', '____head'): TURN_OF_BONE[BNAME.index(nm + suffix)] = fr


BODY_TURN = (TURN_OF_BONE[SKIN_I] * SKIN_W).sum(1)


def bone_weight(skin_i, skin_w, bones):
    m = np.isin(skin_i, list(bones))
    return (skin_w * m).sum(1)


def joint(V, name):
    return V[JOINTS[name]].mean(0)


def pose_arms(V, skin_i, skin_w, pivots):
    out = V.copy()
    for side, sign in (('L', -1.0), ('R', 1.0)):
        w = bone_weight(skin_i, skin_w, ARM[side])[:, None]
        R = rot_z(sign * ARM_DOWN_DEG)
        p = pivots[side]
        out += w * (((V - p) @ R.T + p) - V)
    return out


def write_glb(path, meshes):
    """meshes: list of dict(name, pos, nrm, uv, turn, idx). Writes a minimal binary glTF."""
    bin_parts, views, accessors, gl_meshes, nodes = [], [], [], [], []
    offset = 0

    def add(arr, target, comp, typ, minmax=False):
        nonlocal offset
        b = arr.tobytes(); pad = (-len(b)) % 4
        views.append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(b), 'target': target})
        bin_parts.append(b + b'\0' * pad); offset += len(b) + pad
        acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': len(arr), 'type': typ}
        if minmax: acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    for m in meshes:
        attrs = {
            'POSITION': add(m['pos'].astype('<f4'), 34962, 5126, 'VEC3', True),
            'NORMAL': add(m['nrm'].astype('<f4'), 34962, 5126, 'VEC3'),
            'TEXCOORD_0': add(m['uv'].astype('<f4'), 34962, 5126, 'VEC2'),
            '_TURN': add(m['turn'].astype('<f4'), 34962, 5126, 'SCALAR'),
        }
        big = len(m['pos']) > 65535
        ind = add(m['idx'].astype('<u4' if big else '<u2').reshape(-1), 34963, 5125 if big else 5123, 'SCALAR')
        gl_meshes.append({'name': m['name'], 'primitives': [{'attributes': attrs, 'indices': ind}]})
        nodes.append({'name': m['name'], 'mesh': len(gl_meshes) - 1})
    gltf = {'asset': {'version': '2.0', 'generator': 'studio-light build_models.py', 'copyright': 'MakeHuman assets, CC0'},
            'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}], 'nodes': nodes, 'meshes': gl_meshes,
            'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': offset}]}
    js = json.dumps(gltf, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
    blob = b''.join(bin_parts)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(blob), 0x004E4942)); f.write(blob)


def build_mesh(name, V, polys, UV, turn, keep=None):
    """Split vertices per (vertex, uv) pair, triangulate, compute smooth normals."""
    nrm = np.zeros_like(V)
    tris = []
    for vi, uv, mat in polys:
        if keep is not None and not keep(vi, mat): continue
        order = [(0, 1, 2), (0, 2, 3)] if len(vi) == 4 else [(0, 1, 2)]
        for a, b, c in order:
            tris.append(((vi[a], uv[a] if uv else 0), (vi[b], uv[b] if uv else 0), (vi[c], uv[c] if uv else 0)))
            n = np.cross(V[vi[b]] - V[vi[a]], V[vi[c]] - V[vi[a]])
            for k in (a, b, c): nrm[vi[k]] += n
    ln = np.linalg.norm(nrm, axis=1); ln[ln == 0] = 1
    nrm /= ln[:, None]
    remap, pos, nr, uvo, tu, idx = {}, [], [], [], [], []
    for tri in tris:
        for key in tri:
            if key not in remap:
                remap[key] = len(pos)
                v, u = key
                pos.append(V[v]); nr.append(nrm[v]); tu.append(turn[v])
                uvo.append([UV[u][0], 1.0 - UV[u][1]] if len(UV) else [0, 0])
            idx.append(remap[key])
    return {'name': name, 'pos': np.array(pos), 'nrm': np.array(nr), 'uv': np.array(uvo), 'turn': np.array(tu), 'idx': np.array(idx)}


def fit_proxy(path, V_morph, V_posed):
    j, PV, PUV, polys = load_three(path)
    refs = np.array(j['ref_vIdxs']); w = np.array(j['weights']); off = np.array(j['offsets'])
    used = np.unique(refs)
    ext0 = np.ptp(BASE_V[used], axis=0); ext1 = np.ptp(V_morph[used], axis=0)
    scale = np.where(ext0 > 1e-6, ext1 / np.maximum(ext0, 1e-6), 1.0)
    P = (V_posed[refs] * w[:, :, None]).sum(1) + off * scale
    n = min(len(PV), len(refs))  # a few assets carry unused trailing vertices
    turn = np.zeros(len(PV)); turn[:n] = (BODY_TURN[refs[:n]] * w[:n]).sum(1)
    Pfull = PV.copy(); Pfull[:n] = P[:n]; P = Pfull
    return j, P, PUV, polys, turn


def copy_tex(src, dst, mode=None, size=None, gray=False, jpeg=False):
    dst = os.path.join(OUT, 'tex', dst)
    im = Image.open(src)
    if gray:
        im = im.convert('RGBA'); a = np.asarray(im).astype(np.float32)
        lum = a[..., :3].mean(-1)
        vis = a[..., 3] > 40
        if vis.any(): lum = np.clip(lum / max(np.percentile(lum[vis], 92), 1) * 215, 0, 255)
        a[..., 0] = a[..., 1] = a[..., 2] = lum
        im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    if mode: im = im.convert(mode)
    if size and im.size[0] > size: im = im.resize((size, size), Image.LANCZOS)
    if jpeg: im.convert('RGB').save(dst, quality=92)
    else: im.save(dst, optimize=True)


meta = {}
for g in GENDERS:
  for age, w_old in AGES.items():
    for e in ETHNIC:
        Vm = BASE_V.copy()
        for a_name, w in (('young', 1.0 - w_old), ('old', w_old)):
            if w <= 0: continue
            for t in (f'macrodetails/{ETHNIC[e]}-{g}-{a_name}.target', f'macrodetails/universal-{g}-{a_name}-averagemuscle-averageweight.target'):
                idx, d = load_target(t)
                Vm[idx] += w * d
        pivots = {s: joint(Vm, f'upperarm01.{s}____head') for s in 'LR'}
        Vp = pose_arms(Vm, SKIN_I, SKIN_W, pivots)
        floor = Vp[[v for vi, uv, m in BASE_POLYS if m == BODY_MAT for v in vi]][:, 1].min()

        def finish(m):
            m['pos'] = (m['pos'] - [0, floor, 0]) * SCALE
            return m

        meshes = []
        proxies = [('eyes', 'eyes/HighPolyEyes/HighPolyEyes.json'), ('brows', 'eyebrows/eyebrow001/eyebrow001.json'),
                   ('lashes', 'eyelashes/Eyelashes01/Eyelashes01.json')]
        proxies += [(f'hair_{h}', f'hair/{h}/{h}.json') for h in HAIR[g]]
        proxies += [('clothes', f'clothes/{c}/{c}.json') for c in CLOTHES[g]]
        dele = np.zeros(NV, dtype=bool)
        for name, rel in proxies:
            j, P, PUV, polys, pturn = fit_proxy(os.path.join(PUB, 'proxies', rel), Vm, Vp)
            if name == 'clothes': dele |= np.array(j['metadata'].get('deleteVerts', [0] * NV), dtype=bool)
            mesh = build_mesh(name, P, polys, PUV, pturn)
            if name == 'clothes': mesh['pos'] = mesh['pos'] + mesh['nrm'] * 0.06  # 6 mm of ease so skin never pokes through
            meshes.append(finish(mesh))
        # body with the faces under the clothes removed
        meshes.append(finish(build_mesh('body', Vp, BASE_POLYS, BASE_UV, BODY_TURN,
                                        keep=lambda vi, mat: mat == BODY_MAT and not all(dele[v] for v in vi))))
        key = f'{g}_{e}_{age}'
        write_glb(os.path.join(OUT, key + '.glb'), meshes)
        eyes_pos = meshes[0]['pos']
        neck = (joint(Vp, 'neck02____head') - [0, floor, 0]) * SCALE
        top = meshes[-1]['pos'][:, 1].max()
        meta[key] = {'eyeY': round(float(eyes_pos[:, 1].mean()), 4), 'eyeZ': round(float(eyes_pos[:, 2].max()), 4),
                     'neck': [round(float(x), 4) for x in neck], 'top': round(float(top), 4), 'hair': HAIR[g]}
        print(key, 'verts', sum(len(m['pos']) for m in meshes), os.path.getsize(os.path.join(OUT, key + '.glb')) // 1024, 'KB', meta[key])

json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
with open(os.path.join(os.path.dirname(__file__), '..', 'src', 'models-meta.js'), 'w') as f:
    f.write('// Generated by tools/build_models.py. Heights in metres.\nexport const MODEL_META = ' + json.dumps(meta, indent=1) + ';\n')

# textures (full resolution originals from the asset pack)
import glob
PK = args.pack
SKIN_FILE = {'cau': 'lightskinned_{g}_diffuse', 'asi': 'lightskinned_{g}_diffuse3', 'afr': 'darkskinned_{g}_diffuse'}
for g in GENDERS:
    for age in AGES:
        for e in ETHNIC:
            base = SKIN_FILE[e].format(g=g)
            if age == 'old' and e == 'asi': base = base.replace('diffuse3', 'diffuse2')
            src = glob.glob(f'{PK}/skins/{age}_{ETHNIC[e]}_{g}/{age}_{base}.png')
            assert src, (g, age, e)
            copy_tex(src[0], f'skin_{g}_{e}_{age}.jpg', jpeg=True)
for c in ('brown', 'blue', 'green'): copy_tex(f'{PK}/eyes/materials/{c}_eye.png', f'eye_{c}.png', size=512)
copy_tex(f'{PK}/eyebrows/eyebrow001/eyebrow001.png', 'brows.png', gray=True)
copy_tex(f'{PK}/eyelashes/eyelashes01/eyelashes01.png', 'lashes.png')
for h in sorted(set(sum(HAIR.values(), []))):
    src = [f for f in glob.glob(f'{PK}/hair/{h.lower()}/*.png') if 'normal' not in f]
    copy_tex(src[0], f'hair_{h}.png', gray=True, size=1024, mode='LA')
for g in GENDERS:
    c = CLOTHES[g][0]
    copy_tex(f'{PK}/clothes/{c}/{c}_diffuse.png', f'clothes_{g}.jpg', gray=True, size=1024, jpeg=True)
    copy_tex(f'{PK}/clothes/{c}/{c}_normal.png', f'clothes_{g}_n.jpg', size=1024, jpeg=True)
print('done')
