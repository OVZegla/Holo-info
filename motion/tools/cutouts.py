"""Détourage des monuments (rembg, modèle isnet-general-use) et préparation des photos.

Usage (depuis motion/) :  python tools/cutouts.py
Entrées : assets/raw/*.jpg (tools/fetch-photos.mjs)
Sorties : public/cutouts/<id>.png (fond transparent, rogné)  et  public/photos/<id>.jpg (≤ 1800 px)
"""
from pathlib import Path
import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage


def keep_main(img):
    """Ne garde que le plus grand bloc opaque (supprime pavés, drapeaux isolés, débris)."""
    a = np.array(img)
    solid = a[:, :, 3] > 40
    lab, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        main = lab == (1 + int(np.argmax(sizes)))
        main = ndimage.binary_dilation(main, iterations=3)  # garde le liseré antialiasé
        a[:, :, 3] = np.where(main, a[:, :, 3], 0)
    return Image.fromarray(a)

RAW = Path('assets/raw')
CUT = Path('public/cutouts'); CUT.mkdir(parents=True, exist_ok=True)
PHO = Path('public/photos'); PHO.mkdir(parents=True, exist_ok=True)

# id → zone à garder avant détourage (fractions : gauche, haut, droite, bas) pour isoler le monument
CUTOUTS = {
    'beffroi': (0.25, 0.0, 0.77, 0.962),
    'hoteldeville': (0.17, 0.06, 0.79, 0.925),
}
# façades plates (Labanque) : en photo encadrée plutôt que détourées
PHOTOS = ['grandplace', 'noel1', 'noel2', 'labanque']

session = new_session('isnet-general-use')
for cid, (l, t, r, b) in CUTOUTS.items():
    im = Image.open(RAW / f'{cid}.jpg').convert('RGB')
    w, h = im.size
    im = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    im.thumbnail((1600, 2800), Image.LANCZOS)
    out = keep_main(remove(im, session=session, post_process_mask=True))
    out = out.crop(out.getbbox())  # rognage au plus juste
    out.save(CUT / f'{cid}.png', optimize=True)
    print('détouré', cid, out.size)

for pid in PHOTOS:
    im = Image.open(RAW / f'{pid}.jpg').convert('RGB')
    im.thumbnail((1800, 1800), Image.LANCZOS)
    im.save(PHO / f'{pid}.jpg', quality=88)
    print('photo', pid, im.size)
