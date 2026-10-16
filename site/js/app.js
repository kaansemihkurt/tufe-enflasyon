/* Enflasyon ortalaması neyi saklıyor? Kaydırmalı veri hikâyesi.
   Grafikler D3.js ile çizilir; tüm değerler data/ klasöründeki CSV dosyalarından okunur
   (sunucusuz çift tıklayarak açılırsa js/data.js içindeki birebir kopya kullanılır). */
const tr = d3.formatLocale({decimal: ",", thousands: ".", grouping: [3], currency: ["", ""]});
const f0 = tr.format(",.0f"), f1 = tr.format(",.1f");
const AY = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
/* Renk anlamı tüm sabit grafiklerde aynı: kehribar = genel TÜFE'nin üstünde, mavi = altında, açık = genel TÜFE */
const C = {txt:"#f3f1ea", up:"#e3b45f", down:"#6aa9d8", gray:"#6b7587", ink:"#151a23", grid:"#2c3547"};
/* Keşif aracında en fazla 6 seri ayırt edilmesi gerektiği için Okabe-Ito (renk körlüğü dostu) paleti */
const OI = ["#56B4E9", "#E69F00", "#009E73", "#CC79A7", "#D55E00", "#F0E442"];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = reduce ? 0 : 600;
const monthName = d => AY[d.getMonth()] + " " + d.getFullYear();
const ek = n => ({1: "'i", 2: "'si", 3: "'ü", 4: "'ü", 5: "'i", 6: "'sı"}[n] || "'i");

const FILES = ["data/tufe_endeks_aylik_2020-2026.csv", "data/gruplar_ozet_eylul2026.csv", "data/tufe_endeks_aylik_2005-2026.csv"];
function fromEmbedded() {
  return new Promise((res, rej) => {
    if (window.TUFE_DATA) return res(window.TUFE_DATA);
    const s = document.createElement("script");
    s.src = "js/data.js"; s.onload = () => res(window.TUFE_DATA); s.onerror = rej;
    document.head.appendChild(s);
  }).then(D => [D.endeks, D.ozet, D.tam].map(t => d3.csvParse(t)));
}
Promise.all(FILES.map(f => d3.csv(f))).catch(fromEmbedded)
  .then(([rows, sum, full]) => init(rows, sum, full))
  .catch(err => { console.error(err); document.getElementById("err").hidden = false; });

const DESC = {
  "0": "Tüm harcama gruplarının, hanelerin bütçesindeki paylarına göre ağırlıklandırılmış ortalaması. Diğer grupları bu çizgiyle kıyaslıyoruz.",
  "01": "Ekmek, et, süt, sebze-meyve gibi gıdalar ile alkolsüz içecekleri kapsar. Hanelerin bütçesinde en büyük paylardan birini tutar.",
  "02": "Alkollü içecekler, sigara ve tütün ürünlerini kapsar.",
  "03": "Giysiler ve ayakkabılar. Sezon geçişlerinden etkilendiği için çizgisi mevsimsel olarak inip çıkar; kısa dönemde yanıltıcı olabilir.",
  "04": "Kira, su, elektrik, doğalgaz ve diğer yakıtlar ile konut bakım giderlerini kapsar.",
  "05": "Mobilya, ev eşyaları ve evin günlük bakımı için harcamalar.",
  "06": "İlaç, tıbbi ürünler ve sağlık hizmetleri.",
  "07": "Akaryakıt, araç alımı ve işletmesi, toplu taşıma gibi ulaşım harcamaları.",
  "08": "Telefon, internet ve iletişim hizmetleri ile ilgili cihaz ve ürünler.",
  "09": "Spor, kültür, eğlence, kitap ve benzeri boş zaman harcamaları.",
  "10": "Okul, üniversite ve kurs gibi eğitim hizmetlerinin ücretleri.",
  "11": "Lokanta, kafe gibi dışarıda yemek hizmetleri ile konaklama.",
  "12": "Sigorta primleri ve finansal hizmet ücretleri.",
  "13": "Kişisel bakım ürünleri ve hizmetleri ile başka yerde sınıflandırılmayan çeşitli mal ve hizmetler."
};

function dodge(items, gap) {
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) {
    if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
  }
  return items;
}

function init(rows, sum, full) {
  const parse = d3.timeParse("%Y-%m");
  const info = new Map(sum.map(d => [d.grup_kodu, {ad: d.grup_kisa_ad, art: +d.artis_aralik2020_eylul2026_yuzde, w: +d.agirlik_yuzde_2026}]));
  const series = d3.groups(rows, d => d.grup_kodu).map(([kod, v]) => ({
    kod, ...info.get(kod),
    pts: v.map(d => ({t: parse(d.tarih), raw: +d.endeks_2025_100, rb: +d.endeks_aralik2020_100}))
  }));
  const general = series.find(s => s.kod === "0");
  const lastPt = s => s.pts[s.pts.length - 1];
  const lastT = lastPt(general).t;
  const GEN = info.get("0").art;
  const above = s => s.art > GEN;
  const col = s => s.kod === "0" ? C.txt : (above(s) ? C.up : C.down);
  const groups = series.filter(s => s.kod !== "0");
  const r10 = v => Math.round(v / 10) * 10;
  const topS = d3.greatest(groups, s => lastPt(s).rb), botS = d3.least(groups, s => lastPt(s).rb);
  const gap = k => Math.abs(info.get(k).art - GEN);
  const wpct = k => "Sepet payı: %" + f1(info.get(k).w);

  /* ---------- Sabit (sticky) grafik ---------- */
  const svg = d3.select("#chart");
  const gGrid = svg.append("g").attr("class", "grid");
  const gx = svg.append("g").attr("class", "axis");
  const gy = svg.append("g").attr("class", "axis");
  const gl = svg.append("g");
  const gt = svg.append("g");
  const gA = svg.append("g").attr("class", "anns");
  const yTitle = svg.append("text").attr("class", "axis").attr("fill", "#a3adbd").attr("font-size", 12)
    .attr("font-family", "Inter, sans-serif").text("Endeks (Aralık 2020 = 100)");
  const paths = gl.selectAll("path").data(series).join("path")
    .attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke", C.gray).attr("opacity", 0);
  const labels = gt.selectAll("text").data(series).join("text").attr("class", "lbl").attr("opacity", 0);

  const x = d3.scaleTime().domain([general.pts[0].t, lastT]);
  const y = d3.scaleLinear().domain([0, 1450]);
  const line = d3.line().x(d => x(d.t)).y(d => y(d.rb));
  let m = {t: 26, r: 150, b: 28, l: 46}, cur = 0, narrow = false;

  const hi = codes => s => codes.includes(s.kod) ? {c: col(s), o: 1, w: 3.2, l: 1}
    : s.kod === "0" ? {c: C.txt, o: 1, w: 2.5, l: 1} : {c: C.gray, o: 0.18, w: 1.2, l: 0};
  const steps = [
    {title: `Aralık 2020'de 100 lira olan sepet bugün ${f0(lastPt(general).rb)} lira`,
     st: s => s.kod === "0" ? {c: C.txt, o: 1, w: 3.5, l: 1} : {o: 0},
     an: [{kod: "0", at: 0, t: "Aralık 2020: 100", dx: 16, dy: -34},
          {kod: "0", at: "end", t: `Eylül 2026: ${f0(lastPt(general).rb)}`, dx: -16, dy: -26}]},
    {title: `Gruplar aynı noktadan çıktı, bugün ${f0(r10(lastPt(botS).rb))} ile ${f0(r10(lastPt(topS).rb))} arasındalar`,
     st: s => s.kod === "0" ? {c: C.txt, o: 1, w: 3.5, l: 1} : {c: C.gray, o: 0.5, w: 1.5, l: 0},
     an: [{kod: "0", at: 0, t: "Hepsi 100'den başladı", dx: 16, dy: -34},
          {kod: topS.kod, at: "end", t: `En yüksek: yaklaşık ${f0(r10(lastPt(topS).rb))}`, dx: -16, dy: 4},
          {kod: botS.kod, at: "end", t: `En düşük: yaklaşık ${f0(r10(lastPt(botS).rb))}`, dx: -16, dy: -22}]},
    {title: "Eğitim, lokanta ve konut ortalamanın çok üstüne çıktı",
     st: hi(["10", "11", "04"]),
     an: [{kod: "10", at: "end", t: `Ortalamanın ${f0(gap("10"))}\nyüzde puan üstünde`, dx: -16, dy: 18}]},
    {title: "Giyim ve iletişim ortalamanın çok gerisinde kaldı",
     st: hi(["03", "08"]),
     an: [{kod: "03", at: "end", t: `Ortalamanın ${f0(gap("03"))}\nyüzde puan gerisinde`, dx: -16, dy: -34}]},
    {title: "Gıda ve konut bütçenin yaklaşık %36'sını oluşturuyor, ikisi de ortalamanın üstünde",
     st: hi(["01", "04"]),
     an: [{kod: "04", at: "end", t: wpct("04"), dx: -16, dy: -24}, {kod: "01", at: "end", t: wpct("01"), dx: -16, dy: 34}]},
    {title: "Sigorta, sağlık ve ulaştırma da ortalamanın üstünde, ama bütçedeki ağırlıkları çok farklı",
     st: hi(["12", "06", "07"]),
     an: [{kod: "12", at: "end", t: wpct("12"), dx: -16, dy: -24}, {kod: "07", at: "end", t: wpct("07"), dx: -16, dy: 40}]},
    {title: "Alkol, mobilya, eğlence ve kişisel bakım ortalamanın altında, ama yine de çok pahalandı",
     st: hi(["02", "05", "09", "13"]),
     an: [{kod: "13", at: "end", t: `Ortalamanın ${f0(gap("13"))}\nyüzde puan gerisinde`, dx: -16, dy: 44}]},
    {title: "13 grubun 7'si ortalamanın üstünde, 6'sı altında",
     st: s => s.kod === "0" ? {c: C.txt, o: 1, w: 3, l: 1} : {c: col(s), o: 0.95, w: 2.2, l: 1},
     an: []}
  ];

  function labelText(s) {
    const nm = narrow ? s.ad.split(" ")[0] : s.ad;
    return nm + " %" + f0(s.art);
  }

  function draw(animate) {
    const node = svg.node(), W = node.clientWidth, H = node.clientHeight;
    if (!W || !H) return;
    narrow = W < 520;
    m = {t: 26, r: narrow ? 118 : 238, b: 28, l: narrow ? 40 : 46};
    x.range([m.l, W - m.r]); y.range([H - m.b, m.t]);
    gx.attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(narrow ? 4 : 7).tickFormat(d3.timeFormat("%Y")).tickSizeOuter(0));
    gy.attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(f0).tickSize(0));
    gGrid.attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.r - m.l)).tickFormat(""));
    yTitle.attr("x", 4).attr("y", 14).attr("transform", "translate(0,0)");
    paths.attr("d", d => line(d.pts));
    paint(animate);
  }

  function drawAnn(cfg, k) {
    gA.selectAll("*").remove();
    const W = svg.node().clientWidth;
    (cfg.an || []).forEach(a => {
      const s = series.find(z => z.kod === a.kod);
      const p = a.at === "end" ? lastPt(s) : s.pts[0];
      const px = x(p.t), py = y(p.rb), lines = a.t.split("\n");
      const w = Math.max(...lines.map(l => l.length)) * (narrow ? 6.2 : 6.6);
      let anchor = a.dx < 0 ? "end" : "start";
      let tx = px + a.dx, ty = Math.max(m.t + 14 + (lines.length - 1) * 14, py + a.dy);
      if (anchor === "start") tx = Math.min(tx, W - m.r - w - 4); else tx = Math.max(tx, m.l + w + 4);
      const g = gA.append("g").style("opacity", 0);
      g.append("line").attr("x1", px).attr("y1", py).attr("x2", tx).attr("y2", ty - (lines.length - 1) * 14 - 4)
        .attr("stroke", C.txt).attr("stroke-width", 1).attr("opacity", 0.65);
      g.append("circle").attr("cx", px).attr("cy", py).attr("r", 4.5).attr("fill", C.txt).attr("stroke", C.ink).attr("stroke-width", 1.5);
      const t = g.append("text").attr("class", "ann").attr("x", tx).attr("y", ty - (lines.length - 1) * 14).attr("text-anchor", anchor);
      lines.forEach((l, i) => t.append("tspan").attr("x", tx).attr("dy", i ? 14 : 0).text(l));
      g.transition().delay(k ? 250 : 0).duration(k).style("opacity", 1);
    });
  }

  function paint(animate) {
    const cfg = steps[cur];
    const k = animate ? dur : 0;
    paths.transition().duration(k)
      .attr("stroke", d => cfg.st(d).c || C.gray)
      .attr("opacity", d => cfg.st(d).o)
      .attr("stroke-width", d => cfg.st(d).w || 1.5);
    const W = svg.node().clientWidth;
    const shown = series.filter(s => cfg.st(s).l).map(s => ({s, y: y(lastPt(s).rb) + 4}));
    dodge(shown, 14);
    const pos = new Map(shown.map(o => [o.s.kod, o.y]));
    labels.text(labelText)
      .attr("x", W - m.r + 6)
      .attr("fill", d => cfg.st(d).c || C.gray)
      .transition().duration(k)
      .attr("y", d => pos.has(d.kod) ? pos.get(d.kod) : y(lastPt(d).rb))
      .attr("opacity", d => pos.has(d.kod) ? 1 : 0);
    drawAnn(cfg, k);
    document.getElementById("ctitle").textContent = cfg.title;
    document.getElementById("lg").hidden = cur < 2;
    svg.attr("aria-label", cfg.title + ". Harcama gruplarının Aralık 2020 = 100 endeksli çizgi grafiği.");
    document.querySelectorAll(".scn").forEach((el, i) => el.classList.toggle("on", i === cur));
  }

  draw(false);
  addEventListener("resize", () => draw(false));

  const stepEls = document.querySelectorAll(".step");
  const mobile = matchMedia("(max-width: 820px)").matches;
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      stepEls.forEach(el => el.classList.remove("on"));
      en.target.classList.add("on");
      cur = +en.target.dataset.i;
      paint(true);
    });
  }, {rootMargin: mobile ? "-68% 0px -32% 0px" : "-50% 0px -50% 0px"});
  stepEls.forEach(el => io.observe(el));
  stepEls[0].classList.add("on");

  /* ---------- Açılış görseli: gerçek veriden çizgi grafiği ---------- */
  const hx = d3.scaleTime().domain([general.pts[0].t, lastT]).range([12, 404]);
  const hy = d3.scaleLinear().domain([0, 1400]).range([284, 16]);
  const hl = d3.line().x(d => hx(d.t)).y(d => hy(d.rb));
  const hero = d3.select("#heroArt").append("svg").attr("viewBox", "0 0 420 300").attr("role", "img")
    .attr("aria-label", "13 harcama grubunun Aralık 2020'den bu yana fiyat endeksi, çizgi grafik; kalın açık çizgi genel TÜFE, kehribar çizgiler ortalamanın üstünde, mavi çizgiler altında");
  hero.append("circle").attr("cx", 92).attr("cy", 72).attr("r", 48).attr("fill", "#ffd23f");
  hero.append("text").attr("x", 92).attr("y", 92).attr("text-anchor", "middle").attr("font-size", 58).attr("font-weight", 700)
    .attr("font-family", "Inter, sans-serif").attr("fill", "#151a23").text("₺");
  hero.append("circle").attr("cx", 168).attr("cy", 40).attr("r", 26).attr("fill", "#ff9f45");
  hero.append("text").attr("x", 168).attr("y", 50).attr("text-anchor", "middle").attr("font-size", 30).attr("font-weight", 700)
    .attr("font-family", "Inter, sans-serif").attr("fill", "#151a23").text("₺");
  hero.append("line").attr("x1", 12).attr("x2", 404).attr("y1", 284).attr("y2", 284).attr("stroke", "#3a4358");
  groups.forEach((s, i) => {
    hero.append("path").attr("class", "hline").attr("pathLength", 1).attr("d", hl(s.pts)).attr("fill", "none")
      .attr("stroke", col(s)).attr("stroke-width", 2.4).attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
      .style("animation-delay", i * 90 + "ms");
  });
  hero.append("path").attr("class", "hline").attr("pathLength", 1).attr("d", hl(general.pts)).attr("fill", "none")
    .attr("stroke", C.txt).attr("stroke-width", 4.5).attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
    .style("animation-delay", "1200ms");
  hero.append("text").attr("class", "lbl").attr("x", 404).attr("y", hy(lastPt(general).rb) + 20)
    .attr("text-anchor", "end").attr("fill", C.txt).text("Genel TÜFE %" + f0(GEN));

  /* ---------- Sıralama: yatay çubuk grafik ve sepet payı: treemap ---------- */
  const rowsG = sum.filter(d => d.grup_kodu !== "0").map(d => ({
    kod: d.grup_kodu, ad: d.grup_kisa_ad, v: +d.artis_aralik2020_eylul2026_yuzde, w: +d.agirlik_yuzde_2026
  })).sort((a, b) => b.v - a.v);
  const wUp = d3.sum(rowsG.filter(d => d.v > GEN), d => d.w), wDown = d3.sum(rowsG.filter(d => d.v <= GEN), d => d.w);

  function drawBar() {
    const b = d3.select("#bar"), W = b.node().clientWidth;
    if (!W) return;
    const nr = W < 520, ml = nr ? 96 : 168, mr = nr ? 50 : 64, mt = 44, mb = 48, rh = nr ? 30 : 32;
    const H = mt + rowsG.length * rh + mb;
    b.attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
    b.selectAll("*").remove();
    const xs = d3.scaleLinear().domain([0, d3.max(rowsG, d => d.v)]).range([ml, W - mr]);
    const ys = d3.scaleBand().domain(rowsG.map(d => d.kod)).range([mt, H - mb]).padding(0.28);
    const ticks = xs.ticks(nr ? 3 : 6);
    b.append("g").selectAll("line").data(ticks).join("line")
      .attr("x1", d => xs(d)).attr("x2", d => xs(d)).attr("y1", mt - 6).attr("y2", H - mb)
      .attr("stroke", C.grid).attr("stroke-opacity", 0.8);
    b.append("g").attr("class", "axis").attr("transform", `translate(0,${H - mb})`)
      .call(d3.axisBottom(xs).tickValues(ticks).tickFormat(d => "%" + f0(d)).tickSize(0).tickPadding(8))
      .call(g => g.select(".domain").remove());
    b.append("text").attr("class", "axt").attr("x", nr ? W / 2 : (ml + W - mr) / 2).attr("y", H - 8).attr("text-anchor", "middle")
      .text(nr ? "Artış (%), Ara 2020 – Eyl 2026" : "Aralık 2020'den Eylül 2026'ya fiyat artışı (%)");
    b.append("g").selectAll("rect").data(rowsG).join("rect")
      .attr("x", ml).attr("y", d => ys(d.kod)).attr("width", d => xs(d.v) - ml).attr("height", ys.bandwidth())
      .attr("rx", 3).attr("fill", d => d.v > GEN ? C.up : C.down);
    b.append("g").selectAll("text").data(rowsG).join("text").attr("class", "bl")
      .attr("x", ml - 8).attr("y", d => ys(d.kod) + ys.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .text(d => nr && d.ad.length > 14 ? d.ad.split(" ")[0] : d.ad);
    b.append("g").selectAll("text").data(rowsG).join("text").attr("class", "bv")
      .attr("x", d => xs(d.v) + 6).attr("y", d => ys(d.kod) + ys.bandwidth() / 2).attr("dy", "0.35em")
      .text(d => "%" + f0(d.v));
    const gx0 = xs(GEN);
    b.append("line").attr("x1", gx0).attr("x2", gx0).attr("y1", mt - 14).attr("y2", H - mb)
      .attr("stroke", C.txt).attr("stroke-width", 1.8).attr("stroke-dasharray", "5 4");
    b.append("text").attr("class", "ann").attr("x", gx0).attr("y", mt - 20).attr("text-anchor", "middle")
      .text("Genel TÜFE %" + f0(GEN));
    const top = rowsG[0], bot = rowsG[rowsG.length - 1], ratio = Math.round(top.v / bot.v);
    const ay = ys(bot.kod) + ys.bandwidth() / 2;
    if (!nr) {
      const at = b.append("text").attr("class", "ann").attr("x", xs(bot.v) + 62).attr("text-anchor", "start").attr("y", ay - 6);
      [`← Eğitimdeki artış, giyimdekinin`, `yaklaşık ${ratio} katı`].forEach((l, i) => at.append("tspan").attr("x", xs(bot.v) + 62).attr("dy", i ? 14 : 0).text(l));
    }
    b.attr("aria-label", `Harcama gruplarına göre fiyat artışı, sıralı yatay çubuk grafik. En çok eğitim (%${f0(top.v)}), en az giyim (%${f0(bot.v)}) arttı; genel TÜFE %${f0(GEN)}. Veriler aşağıdaki tabloda.`);
  }

  function drawTree() {
    const t = d3.select("#tree"), W = t.node().clientWidth;
    if (!W) return;
    const nr = W < 520, H = nr ? 520 : Math.max(380, Math.min(460, Math.round(W * 0.42)));
    t.attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
    t.selectAll("*").remove();
    const root = d3.hierarchy({children: rowsG}).sum(d => d.w).sort((a, b) => b.value - a.value);
    d3.treemap().size([W, H]).paddingInner(3).round(true)(root);
    const unl = [];
    const g = t.selectAll("g").data(root.leaves()).join("g").attr("transform", d => `translate(${d.x0},${d.y0})`);
    g.append("title").text(d => `${d.data.ad}: sepet payı %${f1(d.data.w)}, artış %${f0(d.data.v)}`);
    g.append("rect").attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0).attr("rx", 4)
      .attr("fill", d => d.data.v > GEN ? C.up : C.down);
    g.each(function (d) {
      const w = d.x1 - d.x0, h = d.y1 - d.y0, n = d3.select(this);
      if (w >= 64 && h >= 46) {
        const max = Math.max(5, Math.floor((w - 14) / 7)), words = d.data.ad.split(" "), ls = [""];
        words.forEach(wd => {
          const l = ls[ls.length - 1];
          if ((l + " " + wd).trim().length <= max || !l) ls[ls.length - 1] = (l + " " + wd).trim();
          else ls.push(wd);
        });
        const shown = ls.slice(0, 2);
        if (ls.length > 2) shown[1] = shown[1].slice(0, max - 1) + "…";
        const tx = n.append("text").attr("class", "tl").attr("x", 8).attr("y", 20);
        shown.forEach((l, i) => tx.append("tspan").attr("x", 8).attr("dy", i ? 16 : 0).text(l));
        n.append("text").attr("class", "tp").attr("x", 8).attr("y", 20 + shown.length * 16 + 2).text("%" + f1(d.data.w));
      } else if (w >= 40 && h >= 26) {
        n.append("text").attr("class", "tp").attr("x", w / 2).attr("y", h / 2).attr("dy", "0.35em").attr("text-anchor", "middle").text(f1(d.data.w));
        unl.push(d.data);
      } else unl.push(d.data);
    });
    document.getElementById("treeSmall").textContent = unl.length
      ? "Kutuların üzerine gelince ya da tabloya bakınca adlar görünür. Yalnızca sayı yazan veya etiketsiz küçük kutular: " +
        unl.sort((a, b) => b.w - a.w).map(d => `${d.ad} (%${f1(d.w)})`).join(", ") + "."
      : "";
    t.attr("aria-label", `Bugünkü tüketim sepetinin harcama gruplarına göre payı, treemap. Ortalamanın üstünde artan gruplar sepetin %${f1(wUp)}'ini, altında kalanlar %${f1(wDown)}'ini oluşturuyor. Veriler aşağıdaki tabloda.`);
  }

  document.getElementById("treeLg").innerHTML =
    `<span><i class="sw up"></i>Ortalamanın üstünde artan gruplar: sepet payı %${f1(wUp)}</span>` +
    `<span><i class="sw down"></i>Ortalamanın altında artan gruplar: sepet payı %${f1(wDown)}</span>`;
  document.getElementById("tblBody").innerHTML = rowsG.map(d =>
    `<tr><th scope="row">${d.ad}</th><td>%${f0(d.v)}</td><td>%${f1(d.w)}</td><td>${d.v > GEN ? "üstünde" : "altında"} (${d.v > GEN ? "+" : "−"}${f0(Math.abs(d.v - GEN))} yüzde puan)</td></tr>`).join("");
  drawBar(); drawTree();
  addEventListener("resize", () => { drawBar(); drawTree(); });

  /* ---------- Okuyucu keşfi (2005-2026, aralık seçimi) ---------- */
  const fullSeries = d3.groups(full, d => d.grup_kodu).map(([kod, v]) => ({
    kod, ad: info.get(kod).ad, pts: v.map(d => ({t: parse(d.tarih), raw: +d.endeks_2025_100}))}));
  const fGen = fullSeries.find(s => s.kod === "0");
  const months = fGen.pts.map(p => p.t);
  const last = months.length - 1;
  const base = document.getElementById("base"), endEl = document.getElementById("end"), logEl = document.getElementById("logScale");
  base.max = endEl.max = last;
  base.value = Math.max(0, months.findIndex(t => t.getFullYear() === 2020 && t.getMonth() === 11));
  endEl.value = last;
  const defStart = +base.value;
  const chkBox = document.getElementById("chk");
  const sel = new Set(["0", "10", "03", "01"]);
  const slot = new Map();
  function assign() {
    [...slot.keys()].forEach(k => { if (!sel.has(k)) slot.delete(k); });
    const used = new Set(slot.values());
    sel.forEach(k => {
      if (k === "0") { slot.set("0", C.txt); return; }
      if (!slot.has(k)) { const c = OI.find(c => !used.has(c)) || "#9fb3c8"; slot.set(k, c); used.add(c); }
    });
  }
  function paintDots() {
    document.querySelectorAll("#chk .dot").forEach(el => {
      const c = slot.get(el.dataset.k);
      el.style.background = c || "transparent";
      el.style.border = "2px solid " + (c || "#6b7587");
    });
  }
  series.forEach(s => {
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" id="g${s.kod}" value="${s.kod}"><span class="dot" data-k="${s.kod}"></span> ${s.ad}`;
    lab.querySelector("input").checked = sel.has(s.kod);
    chkBox.appendChild(lab);
  });
  chkBox.addEventListener("change", e => {
    const v = e.target.value;
    if (e.target.checked) {
      if (sel.size >= 6) { e.target.checked = false; return; }
      sel.add(v);
    } else if (sel.size > 1) sel.delete(v);
    else e.target.checked = true;
    drawEx();
  });
  base.addEventListener("input", () => drawEx("start"));
  endEl.addEventListener("input", () => drawEx("end"));
  logEl.addEventListener("change", () => drawEx());

  [["2021'den bugüne", defStart, last, false], ["Son 5 yıl", last - 60, last, false], ["Son 12 ay", last - 12, last, false], ["2005'ten bugüne", 0, last, true]].forEach(p => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = p[0];
    b.addEventListener("click", () => { base.value = p[1]; endEl.value = p[2]; logEl.checked = p[3]; drawEx(); });
    document.getElementById("chips").appendChild(b);
  });
  const prog = document.getElementById("prog");
  addEventListener("scroll", () => { const h = document.documentElement; prog.style.transform = `scaleX(${h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)})`; }, {passive: true});

  const ex = d3.select("#ex-chart");
  const exX = ex.append("g").attr("class", "axis"), exY = ex.append("g").attr("class", "axis"),
        exGrid = ex.append("g").attr("class", "grid"), exL = ex.append("g"), exT = ex.append("g");
  const exYT = ex.append("text").attr("fill", "#a3adbd").attr("font-size", 12)
    .attr("font-family", "Inter, sans-serif");

  function renderExplain(bi, ei, sel, gEnd) {
    const gain = s => s.pts[ei].raw / s.pts[bi].raw * 100 - 100;
    const ranked = fullSeries.filter(s => s.kod !== "0").sort((a, b) => gain(b) - gain(a));
    const per = `${monthName(months[bi])} – ${monthName(months[ei])}`, n = ei - bi;
    const picked = fullSeries.filter(s => sel.has(s.kod)), grp = picked.filter(s => s.kod !== "0");
    const low = s => s.ad.toLocaleLowerCase("tr");
    let sm;
    if (!grp.length) {
      sm = `Şu an yalnızca genel TÜFE seçili. ${per} arasında genel fiyat düzeyi %${f0(gEnd)} arttı. Bir grubun ortalamadan ne kadar saptığını görmek için bir ya da daha fazla grup işaretle.`;
    } else {
      const g = grp.map(gain), hiG = grp[g.indexOf(Math.max(...g))], loG = grp[g.indexOf(Math.min(...g))];
      const up = grp.filter(s => gain(s) > gEnd).length;
      if (grp.length === 1) sm = `${per} arasında ${low(hiG)} %${f0(gain(hiG))} arttı; genel TÜFE %${f0(gEnd)} arttı.`;
      else if (up === grp.length) sm = `Seçtiğin ${grp.length} grubun hepsi bu dönemde genel TÜFE'nin (%${f0(gEnd)}) üstünde arttı. En hızlısı ${low(hiG)} (%${f0(gain(hiG))}), en yavaşı ${low(loG)} (%${f0(gain(loG))}).`;
      else if (up === 0) sm = `Seçtiğin grupların hiçbiri bu dönemde genel TÜFE'yi (%${f0(gEnd)}) geçemedi. En çok ${low(hiG)} (%${f0(gain(hiG))}), en az ${low(loG)} (%${f0(gain(loG))}) arttı.`;
      else sm = `Seçtiğin gruplardan ${up}${ek(up)} genel TÜFE'nin (%${f0(gEnd)}) üstünde, ${grp.length - up}${ek(grp.length - up)} altında kaldı. En hızlı artan ${low(hiG)} (%${f0(gain(hiG))}), en yavaş artan ${low(loG)} (%${f0(gain(loG))}); aradaki fark ${f0(gain(hiG) - gain(loG))} yüzde puan.`;
    }
    if (n < 12) sm += " Seçtiğin dönem 12 aydan kısa; mevsimsel dalgalanmalar sonucu çarpıtabilir.";
    else if (n >= 120) sm += " Seçtiğin dönem 10 yıldan uzun; farkları grafikte okumak için logaritmik ölçeği açabilirsin.";
    if (sel.size >= 6) sm += " En fazla 6 grup seçilebilir; yeni bir grup eklemek için birini kaldır.";
    const cards = picked.map(s => {
      const v = gain(s), diff = v - gEnd, c = slot.get(s.kod);
      let cmp = "Karşılaştırma ölçütü olarak kullandığımız çizgi.";
      if (s.kod !== "0") cmp = (Math.abs(diff) < 0.5 ? "Genel TÜFE ile hemen hemen aynı hızda arttı" : `Genel TÜFE'den ${f0(Math.abs(diff))} yüzde puan ${diff > 0 ? "daha fazla" : "daha az"} arttı`) +
        `; 13 grup içinde ${ranked.indexOf(s) + 1}. sırada. Bugünkü sepetteki payı %${f1(info.get(s.kod).w)}.`;
      return `<article class="xc" style="border-color:${c}"><h4 style="color:${c}">${s.ad}: %${f0(v)}</h4><p>${DESC[s.kod]}</p><p class="cm">${cmp}</p></article>`;
    }).join("");
    document.getElementById("explain").innerHTML = `<p class="sm">${sm}</p><div class="xg">${cards}</div>`;
  }

  const tip = document.getElementById("tip");
  const exHov = ex.append("line").attr("stroke", "#e9e6de").attr("stroke-opacity", 0.45).attr("y1", 22).style("display", "none");
  let ctx = null;
  ex.on("pointermove", ev => {
    if (!ctx) return;
    const pts0 = ctx.data[0].pts, t = ctx.xs.invert(d3.pointer(ev)[0]);
    const i = Math.max(0, Math.min(pts0.length - 1, d3.bisector(p => p.t).center(pts0, t)));
    const X = ctx.xs(pts0[i].t);
    exHov.attr("x1", X).attr("x2", X).attr("y2", ctx.H - 28).style("display", null);
    tip.hidden = false;
    tip.innerHTML = `<b>${monthName(pts0[i].t)}</b>` + ctx.data.map(d => `<div><span style="color:${slot.get(d.s.kod)}">■</span> ${d.s.ad}: <b>%${f0(d.pts[i].v - 100)}</b></div>`).join("");
    tip.style.left = (X > ctx.W / 2 ? X - tip.offsetWidth - 12 : X + 12) + "px";
  }).on("pointerleave", () => { tip.hidden = true; exHov.style("display", "none"); });

  function drawEx(src) {
    let bi = +base.value, ei = +endEl.value;
    if (ei - bi < 2) {
      if (src === "end") { bi = ei - 2; if (bi < 0) { bi = 0; ei = 2; } }
      else { ei = bi + 2; if (ei > last) { ei = last; bi = last - 2; } }
      base.value = bi; endEl.value = ei;
    }
    assign(); paintDots();
    document.getElementById("baseTxt").textContent = monthName(months[bi]);
    document.getElementById("endTxt").textContent = monthName(months[ei]);
    const node = ex.node(), W = node.clientWidth, H = node.clientHeight;
    if (!W || !H) return;
    const nr = W < 520, mm = {t: 22, r: nr ? 118 : 200, b: 28, l: 52};
    const logOn = logEl.checked;
    const chosen = fullSeries.filter(s => sel.has(s.kod));
    const data = chosen.map(s => ({s, pts: s.pts.slice(bi, ei + 1).map(p => ({t: p.t, v: p.raw / s.pts[bi].raw * 100}))}));
    const xs = d3.scaleTime().domain([months[bi], months[ei]]).range([mm.l, W - mm.r]);
    const mx = d3.max(data, d => d3.max(d.pts, p => p.v)), mn = d3.min(data, d => d3.min(d.pts, p => p.v));
    const ys = (logOn ? d3.scaleLog().domain([Math.min(mn, 100) * 0.9, mx * 1.1]) : d3.scaleLinear().domain([0, mx * 1.05]))
      .range([H - mm.b, mm.t]).nice();
    const dom = ys.domain();
    const logTicks = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].filter(v => v >= dom[0] && v <= dom[1]);
    const yAx = d3.axisLeft(ys).tickFormat(f0);
    if (logOn) yAx.tickValues(logTicks); else yAx.ticks(5);
    exX.attr("transform", `translate(0,${H - mm.b})`).call(d3.axisBottom(xs).ticks(nr ? 4 : 6)
      .tickFormat(ei - bi >= 36 ? d3.timeFormat("%Y") : d3.timeFormat("%b %Y")).tickSizeOuter(0));
    exY.attr("transform", `translate(${mm.l},0)`).call(yAx.tickSize(0));
    exGrid.attr("transform", `translate(${mm.l},0)`).call(d3.axisLeft(ys).tickValues(logOn ? logTicks : ys.ticks(5)).tickSize(-(W - mm.r - mm.l)).tickFormat(""));
    exYT.attr("x", 4).attr("y", 12).text("Endeks (başlangıç ayı = 100" + (logOn ? ", log ölçek)" : ")"));
    const ln = d3.line().x(p => xs(p.t)).y(p => ys(p.v));
    exL.selectAll("path").data(data, d => d.s.kod).join("path")
      .attr("fill", "none").attr("stroke-width", 2.5).attr("stroke-linejoin", "round")
      .attr("stroke", d => slot.get(d.s.kod)).attr("d", d => ln(d.pts));
    const endV = d => d.pts[d.pts.length - 1].v;
    const ends = dodge(data.map(d => ({d, y: ys(endV(d)) + 4})), 14);
    exT.selectAll("text").data(ends, o => o.d.s.kod).join("text").attr("class", "lbl")
      .attr("x", W - mm.r + 6).attr("y", o => o.y).attr("fill", o => slot.get(o.d.s.kod))
      .text(o => (nr ? o.d.s.ad.split(" ")[0] : o.d.s.ad) + " %" + f0(endV(o.d) - 100));
    const gEnd = fGen.pts[ei].raw / fGen.pts[bi].raw * 100 - 100;
    const pool = data.filter(d => d.s.kod !== "0");
    const per = `${monthName(months[bi])} – ${monthName(months[ei])}`;
    const ttl = document.getElementById("exTitle");
    if (!pool.length) {
      ttl.textContent = `${per}: genel fiyat düzeyi %${f0(gEnd)} arttı`;
    } else {
      const top = pool.slice().sort((a, b) => endV(b) - endV(a))[0];
      const tv = endV(top) - 100, nm = top.s.ad.toLocaleLowerCase("tr");
      ttl.textContent = tv > gEnd
        ? `${per}: ${nm} %${f0(tv)} arttı, genel TÜFE'nin (%${f0(gEnd)}) üstünde`
        : `${per}: seçilen gruplardan hiçbiri genel TÜFE'yi (%${f0(gEnd)}) geçemedi; en çok ${nm} arttı (%${f0(tv)})`;
    }
    document.getElementById("read").innerHTML = data.map(d =>
      `<li><span style="color:${slot.get(d.s.kod)}">■</span> ${d.s.ad}: <b>%${f0(endV(d) - 100)}</b></li>`).join("");
    ex.attr("aria-label", ttl.textContent + ". Seçilen grupların endeks çizgi grafiği; değerler grafiğin altındaki listede.");
    renderExplain(bi, ei, sel, gEnd);
    ctx = {xs, data, H, W};
  }
  drawEx();
  addEventListener("resize", () => drawEx());
}

/* ---------- Sahne geçişleri, görünür olunca beliren öğeler, hafif parallax ---------- */
(function () {
  const layers = [...document.querySelectorAll(".bgl")];
  const so = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) layers.forEach((l, i) => l.classList.toggle("on", i === +e.target.dataset.scene));
  }), {rootMargin: "-45% 0px -45% 0px"});
  document.querySelectorAll("[data-scene]").forEach(el => so.observe(el));
  const ro = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); }
  }), {rootMargin: "0px 0px -8% 0px"});
  document.querySelectorAll(".hero > *, main > section > *").forEach((el, i) => {
    el.classList.add("rv"); el.style.transitionDelay = Math.min(i % 6, 5) * 80 + "ms"; ro.observe(el);
  });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let tick = false;
    addEventListener("scroll", () => {
      if (tick || scrollY > 1200) return;
      tick = true;
      requestAnimationFrame(() => { document.documentElement.style.setProperty("--sy", scrollY); tick = false; });
    }, {passive: true});
  }
})();

/* ---------- Hızlı erişim menüsü: hangi bölümdeyiz? ---------- */
(function () {
  const nav = document.querySelector(".topnav");
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const map = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    const a = map.get(e.target.id);
    if (!e.isIntersecting || !a) return;
    links.forEach(l => l.classList.remove("on")); a.classList.add("on");
    nav.scrollTo({left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: reduce ? "auto" : "smooth"});
  }), {rootMargin: "-40% 0px -55% 0px"});
  map.forEach((a, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
})();

/* ---------- Kişisel bağlantılar: js/config.js içinden doldurulur, boş olanlar gizlenir ---------- */
(function () {
  const L = window.PROJE_LINKS || {};
  document.querySelectorAll("[data-link]").forEach(a => {
    const u = L[a.dataset.link];
    if (u) a.href = u;
    else (a.closest("li") || a).remove();
  });
})();
