/** Canvas commands used by the shared renderer, recorded as standalone SVG. */
export function createSvgContext() {
    const measure = document.createElement('canvas').getContext('2d')!;
    const nodes: string[] = [], defs: string[] = [];
    const esc = (s: unknown) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    let path = '';
    let state: Record<string, any> = { fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',lineJoin:'miter',globalAlpha:1,globalCompositeOperation:'source-over',font:'10px sans-serif',textAlign:'start',textBaseline:'alphabetic',dash:[],matrix:new DOMMatrix(),shadowBlur:0,shadowOffsetX:0,shadowOffsetY:0,shadowColor:'transparent' };
    const stack: typeof state[] = [];
    const common = (extraStyle = '') => {
        const m = state.matrix;
        let filter = '';
        if (state.shadowBlur || state.shadowOffsetX || state.shadowOffsetY) {
            const id = 'shadow'+defs.length;
            defs.push(`<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="${state.shadowOffsetX}" dy="${state.shadowOffsetY}" stdDeviation="${state.shadowBlur/2}" flood-color="${esc(state.shadowColor)}"/></filter>`);
            filter = ` filter="url(#${id})"`;
        }
        const style = extraStyle + (state.globalCompositeOperation === 'source-over' ? '' : `;mix-blend-mode:${state.globalCompositeOperation}`);
        const blend = (style ? ` style="${esc(style)}"` : '') + (state.clip ? ` clip-path="url(#${state.clip})"` : '');
        return ` transform="matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})" opacity="${state.globalAlpha}"${filter}${blend}`;
    };
    const paint = (fill: boolean) => nodes.push(`<path d="${path}" ${fill ? `fill="${esc(state.fillStyle)}"` : `fill="none" stroke="${esc(state.strokeStyle)}" stroke-width="${state.lineWidth}" stroke-linecap="${state.lineCap}" stroke-linejoin="${state.lineJoin}" stroke-dasharray="${state.dash.join(' ')}"`}${common()}/>`);
    const methods: Record<string, (...args:any[])=>any> = {
        save: () => stack.push({...state,dash:state.dash.slice(),matrix:new DOMMatrix(state.matrix.toString())}),
        restore: () => { state=stack.pop()??state; },
        translate: (x,y) => {state.matrix=state.matrix.translate(x,y);},
        rotate: a => {state.matrix=state.matrix.rotate(a*180/Math.PI);},
        scale: (x,y) => {state.matrix=state.matrix.scale(x,y);},
        setLineDash: dash => {state.dash=dash.slice();},
        beginPath: () => {path='';}, closePath: () => {path+='Z ';},
        moveTo: (x,y) => {path+=`M${x} ${y} `;}, lineTo: (x,y) => {path+=`L${x} ${y} `;},
        quadraticCurveTo: (x,y,a,b) => {path+=`Q${x} ${y} ${a} ${b} `;},
        bezierCurveTo: (a,b,c,d,x,y) => {path+=`C${a} ${b} ${c} ${d} ${x} ${y} `;},
        ellipse: (x,y,rx,ry,rotation,start,end,ccw=false) => {
            let span=end-start;
            if(Math.abs(span)>=Math.PI*2)span=ccw?-Math.PI*2:Math.PI*2;
            else if(ccw&&span>0)span-=Math.PI*2;else if(!ccw&&span<0)span+=Math.PI*2;
            const point=(a:number)=>({x:x+rx*Math.cos(a)*Math.cos(rotation)-ry*Math.sin(a)*Math.sin(rotation),y:y+rx*Math.cos(a)*Math.sin(rotation)+ry*Math.sin(a)*Math.cos(rotation)});
            const first=point(start);path+=`${path?'L':'M'}${first.x} ${first.y} `;
            const parts=Math.max(1,Math.ceil(Math.abs(span)/Math.PI));
            for(let i=1;i<=parts;i++){const p=point(start+span*i/parts);path+=`A${rx} ${ry} ${rotation*180/Math.PI} 0 ${ccw?0:1} ${p.x} ${p.y} `;}
        },
        arc: (x,y,r,a,b,ccw) => methods.ellipse(x,y,r,r,0,a,b,ccw),
        roundRect: (x,y,w,h,radius=0) => {
            if(w<0){x+=w;w=-w;}if(h<0){y+=h;h=-h;}
            const r=Math.min(Math.abs(Array.isArray(radius)?radius[0]:radius),w/2,h/2);
            path+=`M${x+r} ${y} H${x+w-r} Q${x+w} ${y} ${x+w} ${y+r} V${y+h-r} Q${x+w} ${y+h} ${x+w-r} ${y+h} H${x+r} Q${x} ${y+h} ${x} ${y+h-r} V${y+r} Q${x} ${y} ${x+r} ${y} Z `;
        },
        fill: () => paint(true),stroke: () => paint(false),
        clip: () => { const id='clip'+defs.length;defs.push(`<clipPath id="${id}"><path d="${path}"/></clipPath>`);state.clip=id; },
        fillRect: (x,y,w,h) => {const prev=path;path=`M${x} ${y} h${w} v${h} h${-w} Z`;paint(true);path=prev;},
        strokeRect: (x,y,w,h) => {const prev=path;path=`M${x} ${y} h${w} v${h} h${-w} Z`;paint(false);path=prev;},
        measureText: text => {measure.font=state.font;return measure.measureText(text);},
        fillText: (text,x,y) => {
            const anchor=['center'].includes(state.textAlign)?'middle':['right','end'].includes(state.textAlign)?'end':'start';
            const baseline=state.textBaseline==='top'?'text-before-edge':state.textBaseline==='middle'?'central':state.textBaseline==='bottom'?'text-after-edge':'alphabetic';
            nodes.push(`<text x="${x}" y="${y}" xml:space="preserve" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="${esc(state.fillStyle)}" ${common('font:'+state.font)}>${esc(text)}</text>`);
        },
        drawImage: (image:HTMLImageElement,...args:number[]) => {
            let [x,y,w,h]=args;
            let source=image.src;
            if(args.length===8){const [sx,sy,sw,sh,dx,dy,dw,dh]=args;const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(sw));canvas.height=Math.max(1,Math.ceil(sh));canvas.getContext('2d')!.drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);source=canvas.toDataURL('image/png');[x,y,w,h]=[dx,dy,dw,dh];}
            // Only embedded images are allowed in a portable export.
            if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(image.src))throw new Error('SVG export requires embedded raster images');
            nodes.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" href="${esc(source)}"${common()}/>`);
        },
    };
    const context = new Proxy({}, {get:(_,key)=>methods[key as string]??state[key as string],set:(_,key,value)=>{state[key as string]=value;return true;}}) as CanvasRenderingContext2D;
    return {context, markup:()=>`<defs>${defs.join('')}</defs>${nodes.join('')}`};
}
