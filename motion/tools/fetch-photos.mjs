// Télécharge les photos libres (Wikimedia Commons) utilisées dans la boucle de veille,
// réduites à 2000 px, et écrit les crédits obligatoires (licences CC BY-SA) dans credits.json.
// Usage : node tools/fetch-photos.mjs   (depuis le dossier motion/)
import fs from 'node:fs';

const UA = { 'User-Agent': 'holo-borne-demo/0.1 (+https://github.com/OVZegla/Holo-info)' };
const PHOTOS = {
  beffroi: "File:Beffroi de Béthune (Vue de l'ouest).jpg",
  grandplace: 'File:La Grand Place de Béthune.jpg',
  labanque: 'File:Labanque à Béthune.jpg',
  hoteldeville: 'File:Hôtel de ville de Béthune.jpg',
  gare: 'File:Béthune - Gare de Béthune (01).JPG',
  noel1: 'File:Nord-Pas-de-Calais 2014-12-23 (16210010686).jpg',
  noel2: 'File:Nord-Pas-de-Calais 2014-12-23 (16238977762).jpg',
};
const OUT = 'assets/raw';
fs.mkdirSync(OUT, { recursive: true });
const credits = {};
for (const [id, title] of Object.entries(PHOTOS)) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=2000&titles=' + encodeURIComponent(title);
  const ii = Object.values((await (await fetch(u, { headers: UA })).json()).query.pages)[0].imageinfo[0];
  const m = ii.extmetadata;
  const img = await fetch(ii.thumburl || ii.url, { headers: UA });
  if (!img.ok) throw new Error(`${id} : HTTP ${img.status}`);
  fs.writeFileSync(`${OUT}/${id}.jpg`, Buffer.from(await img.arrayBuffer()));
  credits[id] = {
    titre: title.slice(5),
    auteur: (m.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
    licence: m.LicenseShortName?.value || '',
    source: ii.descriptionurl,
  };
  console.log(id, '←', credits[id].auteur, '·', credits[id].licence);
}
fs.writeFileSync('assets/credits.json', JSON.stringify(credits, null, 2));
