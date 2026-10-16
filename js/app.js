const tr = d3.formatLocale({decimal: ",", thousands: ".", grouping: [3], currency: ["", ""]});
const f0 = tr.format(",.0f"), f1 = tr.format(",.1f");
const AY = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const C = {txt:"#e9e6de", amber:"#e3b45f", blue:"#6aa9d8", teal:"#7cc9b4", gray:"#6b7587"};
const GC = {"0":"#e9e6de","01":"#ff9f45","02":"#b08968","03":"#4cc9f0","04":"#ffd23f","05":"#a29bfe","06":"#ff6b6b","07":"#2ecc9a","08":"#4d8dff","09":"#ff8fc7","10":"#d66bff","11":"#8bd450","12":"#5ee2e0","13":"#9fb3c8"};
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = reduce ? 0 : 600;
const monthName = d => AY[d.getMonth()] + " " + d.getFullYear();

const loadData = window.TUFE_DATA
  ? Promise.resolve([d3.csvParse(window.TUFE_DATA.endeks), d3.csvParse(window.TUFE_DATA.ozet), d3.csvParse(window.TUFE_DATA.tam)])
  : Promise.all([d3.csv("data/tufe_endeks_aylik_2020-2026.csv"), d3.csv("data/gruplar_ozet_eylul2026.csv"), d3.csv("data/tufe_endeks_aylik_2005-2026.csv")]);
loadData.then(([rows, sum, full]) => init(rows, sum, full))
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
  const lastT = general.pts[general.pts.length - 1].t;

  /* ---------- Sabit (sticky) grafik ---------- */
  const svg = d3.select("#chart");
  const gGrid = svg.append("g").attr("class", "grid");
  const gx = svg.append("g").attr("class", "axis");
  const gy = svg.append("g").attr("class", "axis");
  const gl = svg.append("g");
  const gt = svg.append("g");
  const yTitle = svg.append("text").attr("class", "axis").attr("fill", "#a3adbd").attr("font-size", 12)
    .attr("font-family", "Inter, sans-serif").text("Endeks (Aralık 2020 = 100)");
  const paths = gl.selectAll("path").data(series).join("path")
    .attr("fill", "none").attr("stroke-linejoin", "round").attr("stroke", C.gray).attr("opacity", 0);
  const labels = gt.selectAll("text").data(series).join("text").attr("class", "lbl").attr("opacity", 0);

  const x = d3.scaleTime().domain([general.pts[0].t, lastT]);
  const y = d3.scaleLinear().domain([0, 1450]);
  const line = d3.line().x(d => x(d.t)).y(d => y(d.rb));
  let m = {t: 26, r: 150, b: 28, l: 46}, cur = 0, narrow = false;

  const above = s => s.art > general.art;
  const steps = [
    {title: "Aralık 2020'de 100 lira olan sepet bugün 865 lira",
     st: s => s.kod === "0" ? {c: C.txt, o: 1, w: 3.5, l: 1} : {o: 0}},
    {title: "Gruplar aynı noktadan çıktı, bugün 310 ile 1.380 arasındalar",
     st: s => s.kod === "0" ? {c: C.txt, o: 1, w: 3.5, l: 1} : {c: C.gray, o: 0.5, w: 1.5, l: 0}},
    {title: "Eğitim, lokanta ve konut ortalamanın çok üstüne çıktı",
     st: s => ["10", "11", "04"].includes(s.kod) ? {c: GC[s.kod], o: 1, w: 3.2, l: 1}
       : s.kod === "0" ? {c: C.txt, o: 1, w: 2.5, l: 1} : {c: C.gray, o: 0.18, w: 1.2, l: 0}},
    {title: "Giyim ve iletişim ortalamanın çok gerisinde kaldı",
     st: s => ["03", "08"].includes(s.kod) ? {c: GC[s.kod], o: 1, w: 3.2, l: 1}
       : s.kod === "0" ? {c: C.txt, o: 1, w: 2.5, l: 1} : {c: C.gray, o: 0.18, w: 1.2, l: 0}},
    {title: "Gıda ve konut bütçenin yaklaşık %36'sını oluşturuyor, ikisi de ortalamanın üstünde",
     st: s => ["01", "04"].includes(s.kod) ? {c: GC[s.kod], o: 1, w: 3.2, l: 1}
       : s.kod === "0" ? {c: C.txt, o: 1, w: 2.5, l: 1} : {c: C.gray, o: 0.18, w: 1.2, l: 0}},
    {title: "13 grubun 7'si ortalamanın üstünde, 6'sı altında",
     st: s => s.kod === "0" ? {c: C.txt, o: 1, w: 3, l: 1}
       : {c: GC[s.kod], o: 0.95, w: 2.2, l: 1}}
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

  function paint(animate) {
    const cfg = steps[cur];
    const k = animate ? dur : 0;
    paths.transition().duration(k)
      .attr("stroke", d => cfg.st(d).c || C.gray)
      .attr("opacity", d => cfg.st(d).o)
      .attr("stroke-width", d => cfg.st(d).w || 1.5);
    const H = svg.node().clientHeight, W = svg.node().clientWidth;
    const shown = series.filter(s => cfg.st(s).l).map(s => ({s, y: y(s.pts[s.pts.length - 1].rb) + 4}));
    dodge(shown, 14);
    const pos = new Map(shown.map(o => [o.s.kod, o.y]));
    labels.text(labelText)
      .attr("x", W - m.r + 6)
      .attr("fill", d => cfg.st(d).c || C.gray)
      .transition().duration(k)
      .attr("y", d => pos.has(d.kod) ? pos.get(d.kod) : y(d.pts[d.pts.length - 1].rb))
      .attr("opacity", d => pos.has(d.kod) ? 1 : 0);
    document.getElementById("ctitle").textContent = cfg.title;
    svg.attr("aria-label", cfg.title);
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
    .attr("aria-label", "13 harcama grubunun Aralık 2020'den bu yana fiyat endeksi, çizgi grafik; kalın beyaz çizgi genel TÜFE");
  hero.append("circle").attr("cx", 92).attr("cy", 72).attr("r", 48).attr("fill", "#ffd23f");
  hero.append("text").attr("x", 92).attr("y", 92).attr("text-anchor", "middle").attr("font-size", 58).attr("font-weight", 700)
    .attr("font-family", "Inter, sans-serif").attr("fill", "#151a23").text("₺");
  hero.append("circle").attr("cx", 168).attr("cy", 40).attr("r", 26).attr("fill", "#ff9f45");
  hero.append("text").attr("x", 168).attr("y", 50).attr("text-anchor", "middle").attr("font-size", 30).attr("font-weight", 700)
    .attr("font-family", "Inter, sans-serif").attr("fill", "#151a23").text("₺");
  hero.append("line").attr("x1", 12).attr("x2", 404).attr("y1", 284).attr("y2", 284).attr("stroke", "#3a4358");
  series.filter(s => s.kod !== "0").forEach((s, i) => {
    hero.append("path").attr("class", "hline").attr("pathLength", 1).attr("d", hl(s.pts)).attr("fill", "none")
      .attr("stroke", GC[s.kod]).attr("stroke-width", 2.4).attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
      .style("animation-delay", i * 90 + "ms");
  });
  hero.append("path").attr("class", "hline").attr("pathLength", 1).attr("d", hl(general.pts)).attr("fill", "none")
    .attr("stroke", "#e9e6de").attr("stroke-width", 4.5).attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
    .style("animation-delay", "1200ms");
  hero.append("text").attr("class", "lbl").attr("x", 404).attr("y", hy(general.pts[general.pts.length - 1].rb) + 20)
    .attr("text-anchor", "end").attr("fill", "#e9e6de").text("Genel TÜFE %" + f0(general.art));

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
  const pal = ["#e9e6de", "#e3b45f", "#6aa9d8", "#7cc9b4", "#d98fa8", "#b49be0"];
  const colorOf = new Map();
  series.forEach(s => {
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" id="g${s.kod}" value="${s.kod}"><span class="dot" style="background:${GC[s.kod]}"></span> ${s.ad}`;
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
    const picked = fullSeries.filter(s => sel.has(s.kod)), groups = picked.filter(s => s.kod !== "0");
    const low = s => s.ad.toLocaleLowerCase("tr");
    let sum;
    if (!groups.length) {
      sum = `Şu an yalnızca genel TÜFE seçili. ${per} arasında genel fiyat düzeyi %${f0(gEnd)} arttı. Bir grubun ortalamadan ne kadar saptığını görmek için bir ya da daha fazla grup işaretle.`;
    } else {
      const g = groups.map(gain), hi = groups[g.indexOf(Math.max(...g))], lo = groups[g.indexOf(Math.min(...g))];
      const up = groups.filter(s => gain(s) > gEnd).length;
      if (groups.length === 1) sum = `${per} arasında ${low(hi)} %${f0(gain(hi))} arttı; genel TÜFE %${f0(gEnd)} arttı.`;
      else if (up === groups.length) sum = `Seçtiğin ${groups.length} grubun hepsi bu dönemde genel TÜFE'nin (%${f0(gEnd)}) üstünde arttı. En hızlısı ${low(hi)} (%${f0(gain(hi))}), en yavaşı ${low(lo)} (%${f0(gain(lo))}).`;
      else if (up === 0) sum = `Seçtiğin grupların hiçbiri bu dönemde genel TÜFE'yi (%${f0(gEnd)}) geçemedi. En çok ${low(hi)} (%${f0(gain(hi))}), en az ${low(lo)} (%${f0(gain(lo))}) arttı.`;
      else sum = `Seçtiğin gruplardan ${up}'${up === 1 ? "i" : "i"} genel TÜFE'nin (%${f0(gEnd)}) üstünde, ${groups.length - up}'${groups.length - up === 1 ? "i" : "i"} altında kaldı. En hızlı artan ${low(hi)} (%${f0(gain(hi))}), en yavaş artan ${low(lo)} (%${f0(gain(lo))}); aradaki fark ${f0(gain(hi) - gain(lo))} yüzde puan.`;
    }
    if (n < 12) sum += " Seçtiğin dönem 12 aydan kısa; mevsimsel dalgalanmalar sonucu çarpıtabilir.";
    else if (n >= 120) sum += " Seçtiğin dönem 10 yıldan uzun; farkları grafikte okumak için logaritmik ölçeği açabilirsin.";
    if (sel.size >= 6) sum += " En fazla 6 grup seçilebilir; yeni bir grup eklemek için birini kaldır.";
    const cards = picked.map(s => {
      const v = gain(s), diff = v - gEnd, c = GC[s.kod];
      let cmp = "Karşılaştırma ölçütü olarak kullandığımız çizgi.";
      if (s.kod !== "0") cmp = (Math.abs(diff) < 0.5 ? "Genel TÜFE ile hemen hemen aynı hızda arttı" : `Genel TÜFE'den ${f0(Math.abs(diff))} yüzde puan ${diff > 0 ? "daha fazla" : "daha az"} arttı`) +
        `; 13 grup içinde ${ranked.indexOf(s) + 1}. sırada. Bugünkü sepetteki payı %${f1(info.get(s.kod).w)}.`;
      return `<article class="xc" style="border-color:${c}"><h4 style="color:${c}">${s.ad}: %${f0(v)}</h4><p>${DESC[s.kod]}</p><p class="cm">${cmp}</p></article>`;
    }).join("");
    document.getElementById("explain").innerHTML = `<p class="sm">${sum}</p><div class="xg">${cards}</div>`;
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
    tip.innerHTML = `<b>${monthName(pts0[i].t)}</b>` + ctx.data.map(d => `<div><span style="color:${colorOf.get(d.s.kod)}">■</span> ${d.s.ad}: <b>%${f0(d.pts[i].v - 100)}</b></div>`).join("");
    tip.style.left = (X > ctx.W / 2 ? X - tip.offsetWidth - 12 : X + 12) + "px";
  }).on("pointerleave", () => { tip.hidden = true; exHov.style("display", "none"); });

  function drawEx(src) {
    let bi = +base.value, ei = +endEl.value;
    if (ei - bi < 2) {
      if (src === "end") { bi = ei - 2; if (bi < 0) { bi = 0; ei = 2; } }
      else { ei = bi + 2; if (ei > last) { ei = last; bi = last - 2; } }
      base.value = bi; endEl.value = ei;
    }
    document.getElementById("baseTxt").textContent = monthName(months[bi]);
    document.getElementById("endTxt").textContent = monthName(months[ei]);
    const node = ex.node(), W = node.clientWidth, H = node.clientHeight;
    if (!W || !H) return;
    const nr = W < 520, mm = {t: 22, r: nr ? 118 : 200, b: 28, l: 52};
    const logOn = logEl.checked;
    const chosen = fullSeries.filter(s => sel.has(s.kod));
    chosen.forEach(s => colorOf.set(s.kod, GC[s.kod]));
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
      .attr("stroke", d => colorOf.get(d.s.kod)).attr("d", d => ln(d.pts));
    const endV = d => d.pts[d.pts.length - 1].v;
    const ends = dodge(data.map(d => ({d, y: ys(endV(d)) + 4})), 14);
    exT.selectAll("text").data(ends, o => o.d.s.kod).join("text").attr("class", "lbl")
      .attr("x", W - mm.r + 6).attr("y", o => o.y).attr("fill", o => colorOf.get(o.d.s.kod))
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
      `<li><span style="color:${colorOf.get(d.s.kod)}">■</span> ${d.s.ad}: <b>%${f0(endV(d) - 100)}</b></li>`).join("");
    ex.attr("aria-label", ttl.textContent);
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
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    addEventListener("scroll", () => document.documentElement.style.setProperty("--sy", scrollY), {passive: true});
})();

/* ---------- Hızlı erişim menüsü: hangi bölümdeyiz? ---------- */
(function () {
  const nav = document.querySelector(".topnav");
  const links = [...nav.querySelectorAll("a")];
  const map = new Map(links.map(a => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    const a = map.get(e.target.id);
    if (!e.isIntersecting || !a) return;
    links.forEach(l => l.classList.remove("on")); a.classList.add("on");
    nav.scrollTo({left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: "smooth"});
  }), {rootMargin: "-40% 0px -55% 0px"});
  map.forEach((a, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
})();
