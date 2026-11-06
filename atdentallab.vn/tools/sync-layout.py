"""Generate the same static header/footer for every AT Dental HTML page."""
from pathlib import Path
from html import escape
import re
root=Path(__file__).resolve().parents[1]
items=[('trang-chu.html','Trang chủ'),('gioi-thieu.html','Giới thiệu'),('san-pham.html','Sản phẩm'),('dang-rang.html','Dáng răng'),('index.html','Kiểm tra bảo hành'),('tin-tuc.html','Tin tức'),('lien-he.html','Liên hệ')]
canonical=(root/'index.html').read_text()
footer=re.search(r'<footer class="site-footer">.*?</footer>',canonical,re.S).group().replace('href="index.html"><img', 'href="trang-chu.html"><img')
for p in root.glob('*.html'):
 links=''.join(f'<a href="{url}"'+(' class="active" aria-current="page"' if url==p.name else '')+f'>{escape(label)}</a>' for url,label in items)
 header='<header class="site-header"><nav class="nav" aria-label="Điều hướng chính"><a class="logo" href="trang-chu.html" aria-label="AT Dental Lab – Trang chủ"><img src="assets/logo.png" alt="AT Dental Lab"></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="links" aria-label="Mở danh mục"><span aria-hidden="true">☰</span></button><div id="links" class="links">'+links+'</div></nav></header>'
 s=p.read_text()
 s=re.sub(r'<header class="site-header">.*?</header>',lambda _:header,s,flags=re.S)
 s=re.sub(r'<footer class="site-footer">.*?</footer>',lambda _:footer,s,flags=re.S)
 p.write_text(s)
 print(p.name)
