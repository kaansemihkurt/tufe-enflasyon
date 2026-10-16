# Enflasyon ortalaması neyi saklıyor?

TÜİK'in Tüketici Fiyat Endeksi (TÜFE) verilerini kullanarak 13 harcama grubunun Aralık 2020'den Eylül 2026'ya kadar nasıl farklı hızlarda arttığını anlatan, kaydırmayla ilerleyen interaktif bir veri hikâyesi. Kullanıcı Arayüzü Tasarımı dersi (Büyük Veri Analistliği programı) için bireysel proje olarak hazırlandı.

**Canlı site:** https://kaansemihkurt.github.io/tufe-enflasyon/

**Çalışma sorusu:** Aralık 2020'den bugüne hangi harcama kalemlerinin fiyatı genel enflasyonun en çok üzerinde arttı ve bu kalemler bütçede ne kadar yer tutuyor?

## Ana bulgular

- Genel fiyat düzeyi bu dönemde yaklaşık 8,65 katına çıktı (%765).
- Eğitim hizmetleri %1.281, lokantalar ve konaklama %1.106, konut %985 arttı; giyim %209, bilgi ve iletişim %318 arttı.
- 13 grubun 7'si ortalamanın üstünde, 6'sı altında. En çok artan, en az artanın yaklaşık 6 katı kadar arttı.
- Ortalamanın üstünde artan gruplar bugünkü sepetin yaklaşık %69,5'ini oluşturuyor.

## Sitede neler var?

- **Hikâye:** 8 adımlı kaydırma. Sabit çizgi grafik her adımda vurgu, renk ve annotation değiştirir.
- **Sıralama:** artış oranlarının sıralı yatay çubuk grafiği ve sepet paylarının treemap'i (tablo olarak da açılabilir).
- **Keşif aracı:** başlangıç/bitiş ayı kaydırıcıları, hazır dönemler, en fazla 6 grup seçimi, logaritmik ölçek.
- **Yöntem:** veri kaynağı, lisans, temizleme ve doğrulama adımları, yapay zekâ beyanı.

## Klasör yapısı

```
tufe-enflasyon/
├── README.md
├── teslim.txt
├── data/
│   ├── raw/                 ham veri (birleştirilmiş TÜİK endeks serisi, ağırlıklar, kontrol tablosu)
│   └── processed/           sitede kullanılan özet veriler (notebook çıktısı)
├── notebooks/
│   └── analiz.ipynb         yükleme → temizleme → keşif → bulgular → doğrulama → dışa aktarım
├── site/
│   ├── index.html
│   ├── css/style.css
│   ├── js/                  app.js, config.js, d3.min.js, data.js (file:// için yedek kopya)
│   ├── data/                notebook'tan dışa aktarılan CSV dosyaları
│   └── img/og.png           paylaşım görseli (1200 × 627)
├── docs/
│   ├── storyboard.pdf
│   ├── tasarim-kararlari.pdf
│   └── lighthouse/          Lighthouse mobil rapor ekran görüntüleri
├── pazarlama/               LinkedIn metni ve paylaşım görseli
├── pages.yml                site/ klasörünü GitHub Pages'e yayınlayan iş akışı
└── .github/workflows/pages.yml   (aynı dosya; GitHub yalnızca bu konumdan okur)
```

## Projeyi yerelde çalıştırma

1. Depoyu indir: `git clone https://github.com/kaansemihkurt/tufe-enflasyon`
2. Siteyi görmek için `site/index.html` dosyasını tarayıcıda aç. Sunucu gerekmez; `file://` ile açıldığında veri `site/js/data.js` içindeki kopyadan okunur. Sunucuyla çalıştırmak istersen: `cd site && python -m http.server 8000`, ardından http://localhost:8000.
3. Analizi yeniden üretmek için: `pip install pandas matplotlib jupyter`, ardından `jupyter notebook notebooks/analiz.ipynb` ve **Restart & Run All**. Defter `site/data/` ve `data/processed/` içindeki CSV'leri yeniden yazar. Sonra `site/js/data.js` kopyasını da güncellemek istersen CSV'leri yeniden bu dosyaya gömmen gerekir.

## Veri

- **Kaynak:** TÜİK, Tüketici Fiyat Endeksi, ana harcama grupları (COICOP 2018, 2'li düzey), aylık, Ocak 2005 – Eylül 2026. https://data.tuik.gov.tr. Erişim: 14 Ekim 2026.
- **Lisans:** TÜİK istatistikleri kaynak gösterilerek kullanılabilir (TÜİK veri portalı kullanım koşulları). Bu çalışmada kaynak olarak TÜİK belirtilmiştir.
- **Temizleme:** 14 seri × 261 ay = 3.654 satır, eksik değer ve yinelenen satır yok. Seriler Aralık 2020 = 100 olacak şekilde yeniden tabanlandı. Eğitimdeki Eylül aylık sıçraması mevsimsel olduğu için aykırı değer sayılmadı.
- **Ağırlıklar** yalnızca 2026 sepetine aittir.

## Kullanılan kütüphaneler ve kod kaynakları

- Python: pandas, numpy, matplotlib (analiz defteri).
- [D3.js](https://d3js.org) v7.9.0 (ISC lisansı): grafikler, ölçekler, treemap.
- Kaydırma mekanizması: tarayıcının kendi Intersection Observer API'si (ek kütüphane yok).
- Yazı tipleri: Inter ve Newsreader (Google Fonts, SIL Open Font License).
- Hazır scrollytelling şablonu kullanılmadı; kaydırma, grafikler ve etkileşim bu projede yazıldı.

## Yapay zekâ kullanım beyanı

Bu projede Claude (Anthropic) yapay zekâ aracı kod yazma desteği ve hata ayıklama için kullanıldı: sitenin HTML, CSS ve JavaScript kodu, D3 grafikleri, analiz defterinin kodu ve belgelendirme dosyaları. Çalışma sorusu, veri seçimi ve analiz kararları bana aittir.

## Yazar

Kaan Semih Kurt · Manisa Celal Bayar Üniversitesi, Büyük Veri Analistliği
