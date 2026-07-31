import{t as e,j as d}from"./index-g93x-iR-.js";import{r as m}from"./vendor-i18n-BmB_KEid.js";const f="gala.thermal.paperSize",h={"58mm":{label:"58mm",paperWidthMm:58,marginHorizontalMm:3,contentWidthPx:181,fontSize:12,headerFontSize:15,totalFontSize:14,smallFontSize:10,lineHeight:1.3},"80mm":{label:"80mm",paperWidthMm:80,marginHorizontalMm:4,contentWidthPx:272,fontSize:13,headerFontSize:17,totalFontSize:15,smallFontSize:11,lineHeight:1.35}};function g(){try{const n=localStorage.getItem(f);if(n&&h[n])return n}catch{}return"58mm"}function b(n){return n?new Date(n).toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}function y({invoice:n,paperSize:a}){const r=h[a],l=Array.isArray(n.items)?n.items:[],o=Number(n.subtotal||0),p=Number(n.discount_amount||0),s=Number(n.tax_amount||0),u=Number(n.total||o-p+s),t={root:{width:`${r.contentWidthPx}px`,fontFamily:"'Courier New', 'Lucida Console', 'Consolas', monospace",fontSize:`${r.fontSize}px`,fontWeight:700,lineHeight:`${r.lineHeight}`,color:"#000",background:"#fff",padding:`6px ${r.marginHorizontalMm}px`,boxSizing:"border-box",WebkitTextStroke:"0.3px #000"},center:{textAlign:"center"},bold:{fontWeight:700},small:{fontSize:`${r.smallFontSize}px`,color:"#000",WebkitTextStroke:"0.3px #000"},sep:{borderTop:"1px dashed #999",margin:"4px 0"},sepBold:{borderTop:"2px solid #000",margin:"4px 0"},row:{display:"flex",justifyContent:"space-between"},muted:{color:"#000"},green:{color:"#166534"}};return e.jsxs("div",{className:"thermal-receipt",style:t.root,children:[e.jsxs("div",{style:{...t.center,marginBottom:"4px"},children:[e.jsx("div",{style:{...t.bold,fontSize:`${r.headerFontSize}px`,letterSpacing:"0.05em",WebkitTextStroke:"0.5px #000"},children:"GALA PRINTING"}),e.jsx("div",{style:t.small,children:"galaprintofficialbali.co.id"}),e.jsx("div",{style:t.small,children:"Dalung, Kuta Utara, Badung, Bali"})]}),e.jsx("div",{style:t.sep}),e.jsxs("div",{style:{marginBottom:"4px"},children:[e.jsxs("div",{children:[e.jsx("span",{style:t.bold,children:"No. Inv"})," : ",n.invoice_number]}),e.jsxs("div",{children:[e.jsx("span",{style:t.bold,children:"No. Ord"})," : ",n.order_number||"—"]}),e.jsxs("div",{children:[e.jsx("span",{style:t.bold,children:"Tanggal"})," : ",b(n.created_at)]}),n.paid_at&&e.jsxs("div",{children:[e.jsx("span",{style:t.bold,children:"Dibayar"})," : ",b(n.paid_at)]}),n.payment_status==="paid"&&e.jsx("div",{style:{...t.bold,...t.green,marginTop:"2px"},children:"** LUNAS **"})]}),e.jsx("div",{style:t.sep}),e.jsxs("div",{style:{marginBottom:"4px"},children:[e.jsx("div",{children:e.jsx("span",{style:t.bold,children:"Customer"})}),e.jsx("div",{children:n.customer_name||"—"}),n.customer_phone&&e.jsxs("div",{style:t.muted,children:["Telp: ",n.customer_phone]})]}),e.jsx("div",{style:t.sep}),e.jsx("div",{style:{marginBottom:"4px"},children:l.length===0?e.jsx("div",{style:t.muted,children:"—"}):l.map((i,c)=>{const x=Number(i.price||0)*Number(i.quantity||1);return e.jsxs("div",{style:{marginBottom:"3px"},children:[e.jsx("div",{style:{wordBreak:"break-word"},children:i.name}),e.jsxs("div",{style:{...t.row,...t.muted,fontSize:`${r.smallFontSize}px`},children:[e.jsxs("span",{children:[i.quantity," x ",d(i.price)]}),e.jsx("span",{children:d(x)})]})]},i.id||c)})}),e.jsx("div",{style:t.sep}),e.jsxs("div",{style:{marginBottom:"2px"},children:[e.jsxs("div",{style:t.row,children:[e.jsx("span",{children:"Subtotal"}),e.jsx("span",{children:d(o)})]}),p>0&&e.jsxs("div",{style:{...t.row,...t.green},children:[e.jsx("span",{children:"Diskon"}),e.jsxs("span",{children:["-",d(p)]})]}),s>0&&e.jsxs("div",{style:t.row,children:[e.jsx("span",{children:"Pajak"}),e.jsx("span",{children:d(s)})]})]}),e.jsx("div",{style:t.sepBold}),e.jsxs("div",{style:{...t.row,...t.bold,fontSize:`${r.totalFontSize}px`,marginBottom:"4px",WebkitTextStroke:"0.4px #000"},children:[e.jsx("span",{children:"TOTAL"}),e.jsx("span",{children:d(u)})]}),n.payment_method&&e.jsxs("div",{style:{marginBottom:"4px",fontSize:`${r.smallFontSize}px`},children:[e.jsx("span",{style:t.bold,children:"Bayar:"})," ",n.payment_method]}),e.jsx("div",{style:t.sep}),e.jsxs("div",{style:{...t.center,fontSize:`${r.smallFontSize}px`,color:"#000",marginTop:"4px"},children:[e.jsx("div",{children:"Terima kasih atas kepercayaan Anda!"}),e.jsx("div",{children:"Barang yang sudah dibeli tidak"}),e.jsx("div",{children:"dapat dikembalikan."})]})]})}function k({invoice:n,onClose:a,autoPrint:r}){const l=m.useRef(null),[o,p]=m.useState(g),s=h[o],u=m.useCallback(i=>{p(i);try{localStorage.setItem(f,i)}catch{}},[]);m.useEffect(()=>{if(r){const i=setTimeout(()=>{t()},400);return()=>clearTimeout(i)}},[]);function t(){var x;const i=((x=l.current)==null?void 0:x.innerHTML)||"",c=window.open("","_blank","width=400,height=600");if(!c){window.print();return}c.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Resi — ${n.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Lucida Console', 'Consolas', monospace;
      font-size: ${s.fontSize}px;
      font-weight: 700;
      -webkit-text-stroke: 0.3px #000;
      width: ${s.paperWidthMm}mm;
      margin: 0 auto;
      background: #fff;
      color: #000;
    }
    @media print {
      @page {
        size: ${s.paperWidthMm}mm auto;
        margin: 0;
      }
      body {
        width: ${s.paperWidthMm}mm;
        margin: 0;
        padding: 3mm ${s.marginHorizontalMm}mm;
      }
    }
  </style>
</head>
<body>
  ${i}
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  <\/script>
</body>
</html>`),c.document.close()}return e.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2e3},onClick:a,children:e.jsxs("div",{style:{background:"#fff",borderRadius:"12px",overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,0.25)",maxHeight:"90vh",overflowY:"auto",width:"420px"},onClick:i=>i.stopPropagation(),children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:"1px solid #e5e7eb"},children:[e.jsx("span",{style:{fontWeight:700,fontSize:"15px"},children:"Preview Resi"}),e.jsx("button",{type:"button",onClick:a,style:{background:"none",border:"none",cursor:"pointer",fontSize:"18px",color:"#6b7280",lineHeight:1},children:"✕"})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",padding:"10px 20px",borderBottom:"1px solid #e5e7eb",background:"#f9fafb"},children:[e.jsx("span",{style:{fontSize:"13px",fontWeight:600,color:"#374151"},children:"Ukuran Kertas:"}),e.jsx("div",{style:{display:"flex",gap:"6px"},children:Object.keys(h).map(i=>e.jsx("button",{type:"button",onClick:()=>u(i),style:{padding:"4px 14px",borderRadius:"6px",border:o===i?"2px solid #785E40":"1px solid #d1d5db",background:o===i?"#785E40":"#fff",color:o===i?"#fff":"#374151",fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s ease"},children:i},i))}),e.jsxs("span",{style:{fontSize:"11px",color:"#9ca3af",marginLeft:"auto"},children:[s.contentWidthPx,"px content"]})]}),e.jsx("div",{style:{padding:"20px",background:"#f9fafb",display:"flex",justifyContent:"center"},children:e.jsx("div",{style:{background:"#fff",boxShadow:"0 2px 12px rgba(0,0,0,0.12)",border:"1px solid #e5e7eb"},children:e.jsx("div",{ref:l,children:e.jsx(y,{invoice:n,paperSize:o})})})}),e.jsxs("div",{style:{display:"flex",gap:"12px",justifyContent:"flex-end",padding:"14px 20px",borderTop:"1px solid #e5e7eb"},children:[e.jsx("button",{type:"button",className:"adm-btn",onClick:a,children:"Tutup"}),e.jsx("button",{type:"button",className:"adm-btn adm-btn--primary",onClick:t,style:{background:"#785E40",borderColor:"#785E40"},children:"Print Resi"})]})]})})}export{k as T};
