import urllib.request

try:
    url = "http://localhost:8399/gml_studio.html"
    req = urllib.request.urlopen(url)
    html = req.read().decode('utf-8')
    print("HTML loaded successfully, length:", len(html))
except Exception as e:
    print("Error fetching page:", e)
