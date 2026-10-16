# Enflasyon ortalaması neyi saklıyor?

TÜİK'in Tüketici Fiyat Endeksi (TÜFE) verilerini kullanarak 13 harcama grubunun Aralık 2020'den Eylül 2026'ya kadar nasıl farklı hızlarda arttığını anlatan, kaydırmayla ilerleyen interaktif bir veri hikâyesi. Kullanıcı Arayüzü Tasarımı dersi için hazırlandı.

Genel fiyat düzeyi bu dönemde yaklaşık 8,65 katına çıktı (%765). Aynı sürede eğitim hizmetleri %1.281, giyim ve ayakkabı ise %209 arttı.

## Neler var?

- **Hikâye:** Kaydırdıkça değişen çizgi grafik; 13 grup Aralık 2020 = 100'den başlıyor.
- **Keşif aracı:** Başlangıç/bitiş ayı, hazır dönemler, en fazla 6 grup seçimi ve logaritmik ölçek.
- **Yöntem:** Veri kaynağı, temizleme ve doğrulama adımları sayfanın sonunda.

## Çalıştırma

Sunucu gerekmez. `index.html` dosyasını tarayıcıda açmak yeterli; veri `js/data.js` içine gömülüdür.

## Klasör yapısı

```
index.html
css/style.css
js/app.js        # grafikler ve etkileşim
js/data.js       # CSV'lerin gömülü kopyası
js/d3.min.js     # D3.js (ISC lisansı)
data/            # TÜİK verisinden türetilen CSV dosyaları
```

## Veri

- Kaynak: [TÜİK](https://data.tuik.gov.tr), TÜFE ana harcama grupları (COICOP 2018, 2'li düzey), aylık, Ocak 2005 – Eylül 2026.
- Tüm seriler Aralık 2020 = 100 olacak şekilde yeniden tabanlandı (yazarın hesabı).
- Ağırlıklar yalnızca 2026 sepetine aittir.
- Verinin kullanımı TÜİK'in kullanım koşullarına tabidir.

## Araçlar

Python (pandas), D3.js, Intersection Observer API.

## Yazar

Kaan Semih Kurt
