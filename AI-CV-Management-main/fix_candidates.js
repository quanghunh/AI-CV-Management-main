const fs = require('fs');
const path = 'src/pages/CandidatesPage.tsx';
let c = fs.readFileSync(path, 'utf8');
const before = c;

// Remove Eye icon from Xem thong tin
c = c.replace(
  /<DropdownMenuItem onClick=\{\(\) => handleViewCandidate\(candidate\)\} className="flex items-center gap-2">\r?\n\s+<Eye[^\n]+\/>\r?\n\s+<span>([^<]+)<\/span>\r?\n\s+<\/DropdownMenuItem>/g,
  '<DropdownMenuItem onClick={() => handleViewCandidate(candidate)}>\r\n                             $1\r\n                           </DropdownMenuItem>'
);

// Remove Edit icon from Chinh sua
c = c.replace(
  /<DropdownMenuItem onClick=\{\(\) => handleEditCandidate\(candidate\)\} className="flex items-center gap-2">\r?\n\s+<Edit[^\n]+\/>\r?\n\s+<span>([^<]+)<\/span>\r?\n\s+<\/DropdownMenuItem>/g,
  '<DropdownMenuItem onClick={() => handleEditCandidate(candidate)}>\r\n                             $1\r\n                           </DropdownMenuItem>'
);

// Remove FileText icon from Xem CV
c = c.replace(
  /<DropdownMenuItem onClick=\{\(\) => handleViewCV\(candidate\)\} className="flex items-center gap-2">\r?\n\s+<FileText[^\n]+\/>\r?\n\s+<span>([^<]+)<\/span>\r?\n\s+<\/DropdownMenuItem>/g,
  '<DropdownMenuItem onClick={() => handleViewCV(candidate)}>\r\n                             $1\r\n                           </DropdownMenuItem>'
);

// Remove Brain icon from Phan tich CV
c = c.replace(
  /<DropdownMenuItem onClick=\{\(\) => handleAnalyzeCV\(candidate\)\} className="flex items-center gap-2">\r?\n\s+<Brain[^\n]+\/>\r?\n\s+<span>([^<]+)<\/span>\r?\n\s+<\/DropdownMenuItem>/g,
  '<DropdownMenuItem onClick={() => handleAnalyzeCV(candidate)}>\r\n                             $1\r\n                           </DropdownMenuItem>'
);

// Remove Trash2 icon from Xoa ung vien
c = c.replace(
  /<DropdownMenuItem onClick=\{\(\) => handleDeleteCandidate\(candidate\)\} className="flex items-center gap-2 text-red-600">\r?\n\s+<Trash2[^\n]+\/>\r?\n\s+<span>([^<]+)<\/span>\r?\n\s+<\/DropdownMenuItem>/g,
  '<DropdownMenuItem onClick={() => handleDeleteCandidate(candidate)} className="text-red-600">\r\n                             $1\r\n                           </DropdownMenuItem>'
);

// Remove wrapper span from Gui mail (already has text-blue-600 className)
c = c.replace(
  /className="flex items-center gap-2 text-blue-600">\r?\n(\s+)<span>(Gửi mail)<\/span>/g,
  'className="text-blue-600">\r\n$1$2'
);

if (c !== before) {
  fs.writeFileSync(path, c, 'utf8');
  console.log('Done. File changed.');
} else {
  console.log('No changes made.');
}
