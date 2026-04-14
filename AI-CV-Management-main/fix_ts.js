const fs = require('fs');
const path = 'src/pages/CandidatesPage.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/onChange=\{e =>/g, "onChange={(e: any) =>");
c = c.replace(/onChange=\{v =>/g, "onChange={(v: any) =>");
c = c.replace(/onValueChange=\{v =>/g, "onValueChange={(v: any) =>");
c = c.replace(/for \(const \[key, file\] of map\)/g, "for (const [key, file] of Array.from(map.entries()))");
c = c.replace(/\.then\(\(\{ data \}\) =>/g, ".then(({ data }: any) =>");

fs.writeFileSync(path, c, 'utf8');
console.log('TS errors fixed.');
