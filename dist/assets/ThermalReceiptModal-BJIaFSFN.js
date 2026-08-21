import{A as j,u as t,k as u}from"./index-BES18fb-.js";import{r as c}from"./vendor-i18n-D7_lQ_0h.js";const f="gala.thermal.paperSize",x={"58mm":{label:"58mm",paperWidthMm:58,marginHorizontalMm:3,contentWidthPx:181,fontSize:14,headerFontSize:18,totalFontSize:16,smallFontSize:12,lineHeight:1.4},"80mm":{label:"80mm",paperWidthMm:80,marginHorizontalMm:4,contentWidthPx:272,fontSize:16,headerFontSize:22,totalFontSize:18,smallFontSize:13,lineHeight:1.45}};function S(){try{const n=localStorage.getItem(f);if(n&&x[n])return n}catch{}return"58mm"}function k(n){return n?new Date(n).toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}function v({invoice:n,paperSize:s,operatorName:m}){const i=x[s],a=Array.isArray(n.items)?n.items:[],h=Number(n.subtotal||0),l=Number(n.discount_amount||0),r=Number(n.tax_amount||0),g=Number(n.total||h-l+r),d=s==="80mm"?60:48,e={root:{width:`${i.contentWidthPx}px`,fontFamily:"'Consolas', 'Courier New', monospace",fontSize:`${i.fontSize}px`,fontWeight:700,lineHeight:`${i.lineHeight}`,color:"#000",background:"#fff",padding:`6px ${i.marginHorizontalMm}px`,boxSizing:"border-box",WebkitTextStroke:"0px"},center:{textAlign:"center"},bold:{fontWeight:700},small:{fontSize:`${i.smallFontSize}px`,color:"#000",WebkitTextStroke:"0px"},sepBold:{borderTop:"2px solid #000",margin:"4px 0"},row:{display:"flex",justifyContent:"space-between"},muted:{color:"#000"}},p={paid:"Lunas",unpaid:"Belum Bayar",partial:"Bayar Sebagian"};return t.jsxs("div",{className:"thermal-receipt",style:e.root,children:[t.jsxs("div",{style:{...e.center,marginBottom:"4px"},children:[t.jsx("img",{src:"/gala-logo2.svg",alt:"Gala Logo",style:{width:`${d}px`,height:`${d}px`,margin:"0 auto 2px",display:"block",filter:"grayscale(1) contrast(1.2)"}}),t.jsx("div",{style:{...e.bold,fontSize:`${i.headerFontSize}px`,letterSpacing:"0.05em"},children:"GALA PRINTING"}),t.jsx("div",{style:e.small,children:"galaprintofficialbali.co.id"}),t.jsx("div",{style:e.small,children:"Dalung, Kuta Utara, Badung, Bali"})]}),t.jsx("div",{style:e.sepBold}),t.jsxs("div",{style:{marginBottom:"4px"},children:[t.jsxs("div",{children:[t.jsx("span",{style:e.bold,children:"No. Nota"}),"  : ",n.invoice_number]}),t.jsxs("div",{children:[t.jsx("span",{style:e.bold,children:"Tanggal"}),"   : ",k(n.created_at)]}),t.jsxs("div",{children:[t.jsx("span",{style:e.bold,children:"Pelanggan"})," : ",n.customer_name||"—"]}),t.jsxs("div",{children:[t.jsx("span",{style:e.bold,children:"No. Telp"}),"  : ",n.customer_phone||"—"]}),t.jsxs("div",{children:[t.jsx("span",{style:e.bold,children:"Operator"}),"  : ",m||"—"]}),t.jsxs("div",{children:[t.jsx("span",{style:e.bold,children:"Status"}),"    : ",p[n.payment_status]||n.payment_status||"—"]})]}),t.jsx("div",{style:e.sepBold}),t.jsx("div",{style:{marginBottom:"4px"},children:a.length===0?t.jsx("div",{style:e.muted,children:"—"}):a.map((o,b)=>{const y=Number(o.price||0)*Number(o.quantity||1);return t.jsxs("div",{style:{marginBottom:"3px"},children:[t.jsxs("div",{style:{wordBreak:"break-word"},children:[b+1,". ",o.name]}),t.jsxs("div",{style:{...e.muted,fontSize:`${i.smallFontSize}px`,paddingLeft:"12px"},children:[t.jsxs("span",{children:[o.quantity," x ",u(o.price)]}),t.jsx("span",{style:{float:"right"},children:u(y)})]})]},o.id||b)})}),t.jsx("div",{style:e.sepBold}),t.jsxs("div",{style:{...e.row,...e.bold,fontSize:`${i.totalFontSize}px`,marginBottom:"4px"},children:[t.jsx("span",{children:"TOTAL"}),t.jsx("span",{children:u(g)})]}),t.jsx("div",{style:e.sepBold}),t.jsxs("div",{style:{fontSize:`${i.smallFontSize}px`,color:"#000",marginTop:"4px"},children:[t.jsx("div",{children:"* Barang yang sudah dibeli tidak"}),t.jsx("div",{children:"  dapat dikembalikan"}),t.jsx("div",{style:{marginTop:"2px"},children:"* Barang yang sudah 2 minggu dan"}),t.jsx("div",{children:"  tidak diambil bukan tanggung"}),t.jsx("div",{children:"  jawab kami"}),t.jsx("div",{style:{...e.center,marginTop:"6px"},children:"Terima kasih atas kepercayaan anda!"})]})]})}function T({invoice:n,onClose:s,autoPrint:m}){const i=c.useRef(null),[a,h]=c.useState(S),{user:l}=c.useContext(j),r=x[a],g=c.useCallback(e=>{h(e);try{localStorage.setItem(f,e)}catch{}},[]);c.useEffect(()=>{if(m){const e=setTimeout(()=>{d()},400);return()=>clearTimeout(e)}},[]);function d(){var o;const e=((o=i.current)==null?void 0:o.innerHTML)||"",p=window.open("","_blank","width=400,height=600");if(!p){window.print();return}p.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Resi — ${n.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: ${r.fontSize}px;
      font-weight: 700;
      -webkit-text-stroke: 0;
      width: ${r.paperWidthMm}mm;
      margin: 0 auto;
      background: #fff;
      color: #000;
    }
    img { display: block; margin: 0 auto 2px; filter: grayscale(1) contrast(1.2); }
    @media print {
      @page {
        size: ${r.paperWidthMm}mm auto;
        margin: 0;
      }
      body {
        width: ${r.paperWidthMm}mm;
        margin: 0;
        padding: 3mm ${r.marginHorizontalMm}mm;
      }
    }
  </style>
</head>
<body>
  ${e}
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  <\/script>
</body>
</html>`),p.document.close()}return t.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2e3},onClick:s,children:t.jsxs("div",{style:{background:"#fff",borderRadius:"12px",overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,0.25)",maxHeight:"90vh",overflowY:"auto",width:"420px"},onClick:e=>e.stopPropagation(),children:[t.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:"1px solid #e5e7eb"},children:[t.jsx("span",{style:{fontWeight:700,fontSize:"15px"},children:"Preview Resi"}),t.jsx("button",{type:"button",onClick:s,style:{background:"none",border:"none",cursor:"pointer",fontSize:"18px",color:"#6b7280",lineHeight:1},children:"✕"})]}),t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",padding:"10px 20px",borderBottom:"1px solid #e5e7eb",background:"#f9fafb"},children:[t.jsx("span",{style:{fontSize:"13px",fontWeight:600,color:"#374151"},children:"Ukuran Kertas:"}),t.jsx("div",{style:{display:"flex",gap:"6px"},children:Object.keys(x).map(e=>t.jsx("button",{type:"button",onClick:()=>g(e),style:{padding:"4px 14px",borderRadius:"6px",border:a===e?"2px solid #785E40":"1px solid #d1d5db",background:a===e?"#785E40":"#fff",color:a===e?"#fff":"#374151",fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:e},e))}),t.jsxs("span",{style:{fontSize:"11px",color:"#9ca3af",marginLeft:"auto"},children:[r.contentWidthPx,"px content"]})]}),t.jsx("div",{style:{padding:"20px",background:"#f9fafb",display:"flex",justifyContent:"center"},children:t.jsx("div",{style:{background:"#fff",boxShadow:"0 2px 12px rgba(0,0,0,0.12)",border:"1px solid #e5e7eb"},children:t.jsx("div",{ref:i,children:t.jsx(v,{invoice:n,paperSize:a,operatorName:l==null?void 0:l.name})})})}),t.jsxs("div",{style:{display:"flex",gap:"12px",justifyContent:"flex-end",padding:"14px 20px",borderTop:"1px solid #e5e7eb"},children:[t.jsx("button",{type:"button",className:"adm-btn",onClick:s,children:"Tutup"}),t.jsx("button",{type:"button",className:"adm-btn adm-btn--primary",onClick:d,style:{background:"#785E40",borderColor:"#785E40"},children:"Print Resi"})]})]})})}export{T};
