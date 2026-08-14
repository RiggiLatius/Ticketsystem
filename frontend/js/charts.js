(function (global) {
  const Charts = {};

  const NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...children) {
    const el = document.createElementNS(NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        el.setAttribute(k, v);
      }
    }
    for (const child of children) {
      if (child == null || child === false) continue;
      if (typeof child === 'string' || typeof child === 'number') el.textContent = String(child);
      else el.append(child);
    }
    return el;
  }

  const PALETTE = {
    neu: '#1f5aa5',
    geloest: '#1a7f37',
    accent: '#0f6cbd',
    warm: '#b76b00',
    danger: '#c8321f',
    muted: '#6e7781',
    grid: '#e1e4e8',
    text: '#1f2328',
    textMuted: '#6e7781',
  };

  function fmt(n) {
    if (n == null) return '';
    return String(Math.round(n));
  }

  function niceMax(v) {
    if (v <= 5) return 5;
    if (v <= 10) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / pow) * pow;
  }

  // Grouped bar chart: series[]={name,color,data:[{label,value}]}
  Charts.groupedBar = function (opts) {
    const width = opts.width || 760;
    const height = opts.height || 260;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const series = opts.series || [];
    if (!series.length || !series[0].data.length) return emptyChart(width, height);

    const labels = series[0].data.map((d) => d.label);
    const allValues = series.flatMap((s) => s.data.map((d) => d.value));
    const maxV = niceMax(Math.max(1, ...allValues));

    const groupWidth = innerW / labels.length;
    const barWidth = Math.max(2, (groupWidth - 8) / series.length);

    const chart = svg('svg', {
      viewBox: `0 0 ${width} ${height}`,
      width: '100%',
      height,
      role: 'img',
      'aria-label': opts.title || 'Diagramm',
    });

    // gridlines + y-axis
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = margin.top + innerH - (innerH * i) / ticks;
      const v = (maxV * i) / ticks;
      chart.append(svg('line', {
        x1: margin.left, x2: margin.left + innerW, y1: y, y2: y,
        stroke: PALETTE.grid, 'stroke-width': 1,
      }));
      chart.append(svg('text', {
        x: margin.left - 6, y: y + 3,
        'text-anchor': 'end', 'font-size': 10, fill: PALETTE.textMuted,
      }, fmt(v)));
    }

    // bars
    for (let li = 0; li < labels.length; li++) {
      const groupX = margin.left + li * groupWidth + 4;
      for (let si = 0; si < series.length; si++) {
        const val = series[si].data[li].value;
        const barH = (val / maxV) * innerH;
        const x = groupX + si * barWidth;
        const y = margin.top + innerH - barH;
        chart.append(svg('rect', {
          x, y, width: barWidth - 1, height: Math.max(0, barH),
          fill: series[si].color, rx: 2,
        }));
        if (val > 0) {
          chart.append(svg('text', {
            x: x + barWidth / 2, y: y - 3,
            'text-anchor': 'middle', 'font-size': 10, fill: PALETTE.text,
          }, val));
        }
      }
      // x-label
      const labelX = margin.left + li * groupWidth + groupWidth / 2;
      chart.append(svg('text', {
        x: labelX, y: margin.top + innerH + 14,
        'text-anchor': 'middle', 'font-size': 10, fill: PALETTE.textMuted,
      }, labels[li]));
    }

    // legend
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    for (const s of series) {
      const item = document.createElement('span');
      item.className = 'chart-legend__item';
      item.innerHTML = `<span class="chart-legend__dot" style="background:${s.color}"></span>${s.name}`;
      legend.append(item);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'chart';
    wrapper.append(chart, legend);
    return wrapper;
  };

  // horizontal bar chart: data=[{label,value,color?}]
  Charts.horizontalBar = function (opts) {
    const data = opts.data || [];
    const width = opts.width || 380;
    const rowH = 26;
    const height = Math.max(60, data.length * rowH + 20);
    if (!data.length) return emptyChart(width, height);

    const maxV = niceMax(Math.max(1, ...data.map((d) => d.value)));
    const labelW = opts.labelWidth || 130;
    const valueW = 40;
    const barsX = labelW + 8;
    const barsW = width - barsX - valueW;

    const chart = svg('svg', {
      viewBox: `0 0 ${width} ${height}`,
      width: '100%', height,
    });

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const y = 10 + i * rowH;
      chart.append(svg('text', {
        x: labelW, y: y + rowH / 2 + 3, 'text-anchor': 'end',
        'font-size': 12, fill: PALETTE.text,
      }, truncate(d.label, 20)));
      const barW = (d.value / maxV) * barsW;
      chart.append(svg('rect', {
        x: barsX, y: y + 5, width: barsW, height: rowH - 12,
        fill: PALETTE.grid, rx: 3,
      }));
      chart.append(svg('rect', {
        x: barsX, y: y + 5, width: Math.max(0, barW), height: rowH - 12,
        fill: d.color || PALETTE.accent, rx: 3,
      }));
      chart.append(svg('text', {
        x: barsX + barsW + 6, y: y + rowH / 2 + 3, 'text-anchor': 'start',
        'font-size': 12, fill: PALETTE.text, 'font-weight': '600',
      }, d.value));
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'chart';
    wrapper.append(chart);
    return wrapper;
  };

  // Donut chart: data=[{label,value,color}]
  Charts.donut = function (opts) {
    const data = opts.data || [];
    const size = opts.size || 200;
    const cx = size / 2, cy = size / 2;
    const rOut = size / 2 - 8;
    const rIn = rOut * 0.6;
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) return emptyChart(size, size);

    const chart = svg('svg', {
      viewBox: `0 0 ${size} ${size}`, width: size, height: size,
    });

    let a0 = -Math.PI / 2;
    for (const d of data) {
      const frac = d.value / total;
      const a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const p0 = [cx + rOut * Math.cos(a0), cy + rOut * Math.sin(a0)];
      const p1 = [cx + rOut * Math.cos(a1), cy + rOut * Math.sin(a1)];
      const p2 = [cx + rIn * Math.cos(a1), cy + rIn * Math.sin(a1)];
      const p3 = [cx + rIn * Math.cos(a0), cy + rIn * Math.sin(a0)];
      const dattr = [
        `M ${p0[0]} ${p0[1]}`,
        `A ${rOut} ${rOut} 0 ${large} 1 ${p1[0]} ${p1[1]}`,
        `L ${p2[0]} ${p2[1]}`,
        `A ${rIn} ${rIn} 0 ${large} 0 ${p3[0]} ${p3[1]}`,
        'Z',
      ].join(' ');
      chart.append(svg('path', { d: dattr, fill: d.color }));
      a0 = a1;
    }
    chart.append(svg('text', {
      x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-size': 20,
      'font-weight': 700, fill: PALETTE.text,
    }, total));
    chart.append(svg('text', {
      x: cx, y: cy + 14, 'text-anchor': 'middle', 'font-size': 11,
      fill: PALETTE.textMuted,
    }, opts.centerLabel || 'Gesamt'));

    const legend = document.createElement('div');
    legend.className = 'chart-legend chart-legend--stack';
    for (const d of data) {
      const item = document.createElement('span');
      item.className = 'chart-legend__item';
      const pct = ((d.value / total) * 100).toFixed(0);
      item.innerHTML = `<span class="chart-legend__dot" style="background:${d.color}"></span>` +
        `<span class="chart-legend__label">${d.label}</span>` +
        `<span class="chart-legend__value">${d.value} (${pct}%)</span>`;
      legend.append(item);
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'chart chart--donut';
    wrapper.append(chart, legend);
    return wrapper;
  };

  function emptyChart(w, h) {
    const chart = svg('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h });
    chart.append(svg('text', {
      x: w / 2, y: h / 2, 'text-anchor': 'middle',
      'font-size': 13, fill: PALETTE.textMuted,
    }, 'Keine Daten im gewählten Zeitraum'));
    const wrapper = document.createElement('div');
    wrapper.className = 'chart chart--empty';
    wrapper.append(chart);
    return wrapper;
  }

  function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  Charts.PALETTE = PALETTE;
  global.Charts = Charts;
})(window);
