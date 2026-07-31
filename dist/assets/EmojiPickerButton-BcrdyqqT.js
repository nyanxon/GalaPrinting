import{t as n}from"./index-IaTFFGBE.js";import{r as i}from"./vendor-i18n-BmB_KEid.js";import{$ as h,d as f}from"./vendor-emoji-jgSk9JFP.js";const w=`
  em-emoji-picker {
    height: 280px !important;
    max-height: 280px !important;
    width: 260px !important;
    min-width: 260px !important;
    font-size: 13px !important;
  }
  @media (max-width: 480px) {
    em-emoji-picker {
      width: calc(100vw - 48px) !important;
      min-width: unset !important;
      max-width: calc(100vw - 48px) !important;
      height: 260px !important;
      max-height: 260px !important;
    }
  }
`;function v({onEmojiSelect:c,inputRef:r}){const[t,a]=i.useState(!1),o=i.useRef(null),[p,d]=i.useState({position:"absolute",bottom:"44px",right:0,zIndex:1e3,boxShadow:"0 4px 24px rgba(0,0,0,0.18)",borderRadius:"12px",overflow:"hidden"});i.useEffect(()=>{if(!t||!o.current)return;const e=o.current.getBoundingClientRect(),s=window.innerWidth<=480?window.innerWidth-48:260,u=window.innerWidth<=480?260:280,m=e.right-s<8,x=e.top-u<8;d({position:"absolute",...x?{top:"44px",bottom:"auto"}:{bottom:"44px",top:"auto"},...m?{left:0,right:"auto"}:{right:0,left:"auto"},zIndex:1e3,boxShadow:"0 4px 24px rgba(0,0,0,0.18)",borderRadius:"12px",overflow:"hidden"})},[t]),i.useEffect(()=>{if(!t)return;function e(s){o.current&&!o.current.contains(s.target)&&a(!1)}return document.addEventListener("mousedown",e),()=>document.removeEventListener("mousedown",e)},[t]);function l(e){c(e.native),a(!1),r!=null&&r.current&&r.current.focus()}return n.jsxs("div",{ref:o,style:{position:"relative",display:"inline-flex",alignItems:"center"},children:[n.jsx("button",{type:"button",onClick:()=>a(e=>!e),title:"Emoji","aria-label":"Buka emoji picker",style:{background:"none",border:"none",cursor:"pointer",fontSize:"20px",lineHeight:1,padding:"4px 5px",display:"flex",alignItems:"center",borderRadius:"6px",opacity:t?1:.75,transition:"opacity 0.15s, background 0.15s"},onMouseEnter:e=>{e.currentTarget.style.background="#f0f0f0"},onMouseLeave:e=>{e.currentTarget.style.background="none"},children:"😊"}),t&&n.jsxs("div",{style:p,children:[n.jsx("style",{children:w}),n.jsx(h,{data:f,onEmojiSelect:l,locale:"en",theme:"light",previewPosition:"none",skinTonePosition:"none",maxFrequentRows:1,perLine:7,emojiSize:22,emojiButtonSize:30})]})]})}export{v as E};
