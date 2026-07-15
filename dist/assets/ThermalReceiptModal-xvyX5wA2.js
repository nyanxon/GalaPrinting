import{s as e,i as l}from"./index-DLsN6CTt.js";import{r as x}from"./vendor-i18n-BORBuKrC.js";const h=197;function p(n){return n?new Date(n).toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—"}function u({invoice:n}){const r=Array.isArray(n.items)?n.items:[],a=Number(n.subtotal||0),d=Number(n.discount_amount||0),o=Number(n.tax_amount||0),i=Number(n.total||a-d+o),t={root:{width:`${h}px`,fontFamily:"'Courier New', Courier, monospace",fontSize:"10px",fontWeight:700,lineHeight:"1.35",color:"#000",background:"#fff",padding:"6px 4px",boxSizing:"border-box",WebkitTextStroke:"0.3px #000"},center:{textAlign:"center"},bold:{fontWeight:700},small:{fontSize:"8px",color:"#555",WebkitTextStroke:"0.2px #555"},sep:{borderTop:"1px dashed #999",margin:"4px 0"},sepBold:{borderTop:"2px solid #000",margin:"4px 0"},row:{display:"flex",justifyContent:"space-between"},muted:{color:"#555"},green:{color:"#166534"}};return e.jsxs("div",{className:"thermal-receipt",style:t.root,children:[e.jsxs("div",{style:{...t.center,marginBottom:"4px"},children:[e.jsx("div",{style:{...t.bold,fontSize:"13px",letterSpacing:"0.05em",WebkitTextStroke:"0.5px #000"},children:"GALA PRINTING"}),e.jsx("div",{style:t.small,children:"galaprintofficialbali.co.id"}),e.jsx("div",{style:t.small,children:"Dalung, Kuta Utara, Badung, Bali"})]}),e.jsx("div",{style:t.sep}),e.jsxs("div",{style:{marginBottom:"4px"},children:[e.jsxs("div",{children:[e.jsx("span",{style:t.bold,children:"No. Inv"})," : ",n.invoice_number]}),e.jsxs("div",{children:[e.jsx("span",{style:t.bold,children:"No. Ord"})," : ",n.order_number||"—"]}),e.jsxs("div",{children:[e.jsx("span",{style:t.bold,children:"Tanggal"})," : ",p(n.created_at)]}),n.paid_at&&e.jsxs("div",{children:[e.jsx("span",{style:t.bold,children:"Dibayar"})," : ",p(n.paid_at)]}),n.payment_status==="paid"&&e.jsx("div",{style:{...t.bold,...t.green,marginTop:"2px"},children:"** LUNAS **"})]}),e.jsx("div",{style:t.sep}),e.jsxs("div",{style:{marginBottom:"4px"},children:[e.jsx("div",{children:e.jsx("span",{style:t.bold,children:"Customer"})}),e.jsx("div",{children:n.customer_name||"—"}),n.customer_phone&&e.jsxs("div",{style:t.muted,children:["Telp: ",n.customer_phone]})]}),e.jsx("div",{style:t.sep}),e.jsx("div",{style:{marginBottom:"4px"},children:r.length===0?e.jsx("div",{style:t.muted,children:"—"}):r.map((s,c)=>{const m=Number(s.price||0)*Number(s.quantity||1);return e.jsxs("div",{style:{marginBottom:"3px"},children:[e.jsx("div",{style:{wordBreak:"break-word"},children:s.name}),e.jsxs("div",{style:{...t.row,...t.muted,fontSize:"9px"},children:[e.jsxs("span",{children:[s.quantity," x ",l(s.price)]}),e.jsx("span",{children:l(m)})]})]},s.id||c)})}),e.jsx("div",{style:t.sep}),e.jsxs("div",{style:{marginBottom:"2px"},children:[e.jsxs("div",{style:t.row,children:[e.jsx("span",{children:"Subtotal"}),e.jsx("span",{children:l(a)})]}),d>0&&e.jsxs("div",{style:{...t.row,...t.green},children:[e.jsx("span",{children:"Diskon"}),e.jsxs("span",{children:["-",l(d)]})]}),o>0&&e.jsxs("div",{style:t.row,children:[e.jsx("span",{children:"Pajak"}),e.jsx("span",{children:l(o)})]})]}),e.jsx("div",{style:t.sepBold}),e.jsxs("div",{style:{...t.row,...t.bold,fontSize:"11px",marginBottom:"4px",WebkitTextStroke:"0.4px #000"},children:[e.jsx("span",{children:"TOTAL"}),e.jsx("span",{children:l(i)})]}),n.payment_method&&e.jsxs("div",{style:{marginBottom:"4px",fontSize:"9px"},children:[e.jsx("span",{style:t.bold,children:"Bayar:"})," ",n.payment_method]}),e.jsx("div",{style:t.sep}),e.jsxs("div",{style:{...t.center,fontSize:"8px",color:"#555",marginTop:"4px"},children:[e.jsx("div",{children:"Terima kasih atas kepercayaan Anda!"}),e.jsx("div",{children:"Barang yang sudah dibeli tidak"}),e.jsx("div",{children:"dapat dikembalikan."})]})]})}function j({invoice:n,onClose:r,autoPrint:a}){const d=x.useRef(null);x.useEffect(()=>{if(a){const i=setTimeout(()=>{o()},400);return()=>clearTimeout(i)}},[]);function o(){var s;const i=((s=d.current)==null?void 0:s.innerHTML)||"",t=window.open("","_blank","width=400,height=600");if(!t){window.print();return}t.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Resi — ${n.invoice_number}</title>
    <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      font-weight: 700;
      -webkit-text-stroke: 0.3px #000;
      width: 220px;
      margin: 0 auto;
      background: #fff;
      color: #000;
    }
    @media print {
      @page { size: 58mm auto; margin: 1mm 3mm; }
      body { width: 100%; }
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
</html>`),t.document.close()}return e.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2e3},onClick:r,children:e.jsxs("div",{style:{background:"#fff",borderRadius:"12px",overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,0.25)",maxHeight:"90vh",overflowY:"auto"},onClick:i=>i.stopPropagation(),children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:"1px solid #e5e7eb"},children:[e.jsx("span",{style:{fontWeight:700,fontSize:"15px"},children:"Preview Resi (58mm)"}),e.jsx("button",{type:"button",onClick:r,style:{background:"none",border:"none",cursor:"pointer",fontSize:"18px",color:"#6b7280",lineHeight:1},children:"✕"})]}),e.jsx("div",{style:{padding:"20px",background:"#f9fafb",display:"flex",justifyContent:"center"},children:e.jsx("div",{style:{background:"#fff",boxShadow:"0 2px 12px rgba(0,0,0,0.12)",border:"1px solid #e5e7eb"},children:e.jsx("div",{ref:d,children:e.jsx(u,{invoice:n})})})}),e.jsxs("div",{style:{display:"flex",gap:"12px",justifyContent:"flex-end",padding:"14px 20px",borderTop:"1px solid #e5e7eb"},children:[e.jsx("button",{type:"button",className:"adm-btn",onClick:r,children:"Tutup"}),e.jsx("button",{type:"button",className:"adm-btn adm-btn--primary",onClick:o,style:{background:"#785E40",borderColor:"#785E40"},children:"Print Resi"})]})]})})}export{j as T};
