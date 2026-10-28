/* ---------- HERO: woven 3D particle loop <-> Australia coastline ---------- */
(function(){
  var MAP=window.THEIANEX_MAP; if(!MAP) return;
  var cv=document.getElementById('stage'); if(!cv||!cv.getContext) return;
  var ctx=cv.getContext('2d'), hero=document.getElementById('hero');
  var title=document.getElementById('heroTitle'), cap=document.getElementById('capLoop'), mtPos=document.getElementById('mtPos');
  var stms=[].slice.call(hero.querySelectorAll('.stm'));
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU=Math.PI*2, TRANS=2.8;
  var SCENES=[{m:'loop',hold:5.6},{m:'map',hold:7.6}];
  var NS=SCENES.length;
  var PAL=['#eaf0fa','#9db4d3','#c4d2e8'],STAR='#dfe8ff',HALO='220,234,255',LIGHT=false;
  function readTheme(){
    var T=window.TX;if(!T)return;
    PAL=[T.token('--dot1'),T.token('--dot2'),T.token('--dot3')];STAR=T.token('--star');HALO=T.token('--halo');LIGHT=T.theme()==='light';
  }
  readTheme();
  window.addEventListener('themechange',function(){readTheme();if(!running)render()});
  /* two figure-eight strands woven around each other */
  var Y0=0.5,EZ=0.3,KT=2,RDZ=0.15,RIN=0.04,PH0=0.9,PERSP=0.12;
  var W=0,H=0,dpr=1,N=0,mobile=false;
  var L={cx:0,cy:0,u:1,per:0};
  var proj={s:1,ox:0,oy:0};
  var M={x:null,y:null,k:null,w:null,n:0,minX:0,maxX:1};
  var P={};
  var stars=[];
  var clk=0,last=0,running=false,started=false;
  var idx=0,sceneT=0,first=true,introT=0,mouse={x:-9999,y:-9999};
  var modeTimer=0,stmTimer=0,prevMode='loop',fromModeStore='loop';
  var introP=0,pT=1,curMode='loop',fromMode='loop',mapW=0,loopW=1;
  var tg=[0,0,0],tmpV=[0,0,0];

  function rnd(a,b){return a+Math.random()*(b-a)}
  function clamp(v,a,b){return v<a?a:v>b?b:v}
  function lerp(a,b,t){return a+(b-a)*t}
  function eio(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function sm(t){return t*t*(3-2*t)}

  /* ring geometry */
  function ring3(t,s,o){
    var cx=Math.sin(t),cy=Y0*Math.sin(2*t),cz=EZ*Math.cos(t),tx=Math.cos(t),ty=2*Y0*Math.cos(2*t),n=Math.hypot(tx,ty);
    var ph=KT*t+PH0+(s?Math.PI:0),ci=Math.cos(ph);
    o[0]=cx+RIN*ci*(-ty/n);o[1]=cy+RIN*ci*(tx/n);o[2]=cz+RDZ*Math.sin(ph);
  }
  var ARCN=2048,TT=new Float32Array(ARCN),RLEN=1;
  (function(){ // t at even steps of arc length so dots are evenly spaced
    var S=6000,cum=new Float32Array(S+1),a=[0,0,0],b=[0,0,0],i;
    ring3(0,0,a);
    for(i=1;i<=S;i++){ring3(i/S*TAU,0,b);cum[i]=cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);a[0]=b[0];a[1]=b[1];a[2]=b[2]}
    RLEN=cum[S];var j=0;
    for(var k=0;k<ARCN;k++){
      var want=k/ARCN*RLEN;while(j<S-1&&cum[j+1]<want)j++;
      var seg=cum[j+1]-cum[j]||1e-9;TT[k]=(j+(want-cum[j])/seg)/S*TAU;
    }
  })();
  function tAt(f){var q=(f%1)*ARCN,k=Math.floor(q),fr=q-k,k2=(k+1)%ARCN;k%=ARCN;var a=TT[k],b=TT[k2];if(k2<k)b+=TAU;return a+(b-a)*fr}

  var VY=0,VP=0;
  function viewParams(t){VY=0.6+0.2*Math.sin(t*0.34);VP=0.10+0.07*Math.sin(t*0.27+1.2)}
  /* ring point -> screen (x,y) and depth z in tg */
  function ringPt(s,f,t){
    ring3(tAt(f),s,tmpV);
    var x=tmpV[0],y=tmpV[1],z=tmpV[2],c=Math.cos(VY),sn=Math.sin(VY),x2=x*c+z*sn,z2=-x*sn+z*c;
    c=Math.cos(VP);sn=Math.sin(VP);var y2=y*c-z2*sn,z3=y*sn+z2*c,k=1/(1-PERSP*z3);
    tg[0]=L.cx+x2*k*L.u;tg[1]=L.cy+y2*k*L.u;tg[2]=z3;
    return tg;
  }

  /* ---- Australia ---- */
  var LON0=0,LAT0=0,C0=Math.cos(26.5*Math.PI/180),BB={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9},AR=1.28;
  (function(){
    MAP.au.forEach(function(r){r.forEach(function(p){BB.x0=Math.min(BB.x0,p[0]);BB.x1=Math.max(BB.x1,p[0]);BB.y0=Math.min(BB.y0,p[1]);BB.y1=Math.max(BB.y1,p[1])})});
    AR=((BB.x1-BB.x0)*C0)/(BB.y1-BB.y0);
  })();
  function project(lon,lat){return [proj.ox+(lon-BB.x0)*C0*proj.s,proj.oy+(BB.y1-lat)*proj.s]}
  function inPoly(x,y,ring){
    var c=false;
    for(var i=0,j=ring.length-1;i<ring.length;j=i++){
      var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
      if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi)) c=!c;
    }
    return c;
  }
  function chaikin(r){
    var o=[];for(var i=0;i<r.length;i++){var a=r[i],b=r[(i+1)%r.length];
      o.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}
    return o;
  }
  /* even resample + moving-average smoothing: removes folded spikes so the dotted coast stays a clean curve */
  function resampleRing(r,step){
    var cum=[0],i;for(i=0;i<r.length;i++){var a=r[i],b=r[(i+1)%r.length];cum.push(cum[i]+Math.hypot(b[0]-a[0],b[1]-a[1]))}
    var total=cum[r.length],cnt=Math.max(12,Math.round(total/step)),o=[],j=0;
    for(i=0;i<cnt;i++){
      var want=i/cnt*total;while(j<r.length-1&&cum[j+1]<want)j++;
      var a2=r[j],b2=r[(j+1)%r.length],f=(want-cum[j])/((cum[j+1]-cum[j])||1e-9);
      o.push([a2[0]+(b2[0]-a2[0])*f,a2[1]+(b2[1]-a2[1])*f]);
    }
    return o;
  }
  function smoothRing(r,k,iters){
    var n=r.length;
    for(var it=0;it<iters;it++){
      var o=[];
      for(var i=0;i<n;i++){var sx=0,sy=0;for(var d=-k;d<=k;d++){var p=r[(i+d+n)%n];sx+=p[0];sy+=p[1]}o.push([sx/(2*k+1),sy/(2*k+1)])}
      r=o;
    }
    return r;
  }
  var box={x:0,y:0,w:0,h:0},mapList=[];
  function buildMap(){
    var rings=MAP.au.map(function(r){return r.map(function(p){return project(p[0],p[1])})});
    var smooth=rings.map(function(r){return smoothRing(resampleRing(r,1.5),mobile?5:8,2)});
    var pitch=mobile?4.2:5.2,pts=[];
    smooth.forEach(function(r){
      var cum=[0],i;for(i=0;i<r.length;i++){var a=r[i],b=r[(i+1)%r.length];cum.push(cum[i]+Math.hypot(b[0]-a[0],b[1]-a[1]))}
      var total=cum[r.length],cnt=Math.max(8,Math.round(total/pitch)),j=0;
      for(i=0;i<cnt;i++){
        var want=i/cnt*total;while(j<r.length-1&&cum[j+1]<want)j++;
        var a2=r[j],b2=r[(j+1)%r.length],f=(want-cum[j])/((cum[j+1]-cum[j])||1e-9);
        pts.push([a2[0]+(b2[0]-a2[0])*f,a2[1]+(b2[1]-a2[1])*f,0,1]);
      }
    });
    var coast=pts.slice(),di=mobile?11:14,minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
    rings.forEach(function(r){r.forEach(function(p){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1])})});
    var tp=project(132.4,-24.4),hx=box.w*0.30,hy=box.h*0.22,hole=!mobile;
    for(var y=minY+di/2;y<maxY;y+=di){
      for(var x=minX+di/2;x<maxX;x+=di){
        var yy=y,xx=x+(Math.round((y-minY)/di)%2?di/2:0),inside=false;
        for(var q=0;q<rings.length;q++){if(inPoly(xx,yy,rings[q])){inside=true;break}}
        if(!inside)continue;
        var md=1e9;for(var c=0;c<coast.length;c++){var ddx=coast[c][0]-xx,ddy=coast[c][1]-yy,dd=ddx*ddx+ddy*ddy;if(dd<md)md=dd}
        if(md<di*di*0.55)continue;
        var w=1;
        if(hole){var nx=(xx-tp[0])/hx,ny=(yy-tp[1])/hy,r2=Math.sqrt(nx*nx+ny*ny);w=0.10+0.90*sm(clamp((r2-0.55)/0.7,0,1))}
        pts.push([xx,yy,1,w]);
      }
    }
    pts.sort(function(a,b){return a[0]-b[0]||a[1]-b[1]});
    mapList=pts;M.minX=minX;M.maxX=maxX;
    return {textX:tp[0],textY:tp[1]};
  }

  function layout(){
    W=hero.clientWidth;H=hero.clientHeight;dpr=Math.min(2,window.devicePixelRatio||1);
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    mobile=W<860;
    var hr=hero.getBoundingClientRect(),tr=title.getBoundingClientRect(),tb=tr.bottom-hr.top;
    var gut=Math.max(16,W*0.04),bottomLim=H-(mobile?150:124),mapBot=mobile?bottomLim:H-112;
    /* map box */
    var mt=tb+(mobile?20:H*0.02),mw,mh;
    if(mobile){mw=Math.min(W-2*gut,(H*0.36)*AR);mh=mw/AR}
    else{mh=mapBot-mt;mw=Math.min(mh*AR,W*0.78);mh=mw/AR}
    box.w=mw;box.h=mh;box.x=(W-mw)/2;box.y=mobile?mt:mt+((mapBot-mt)-mh)/2;
    proj.s=Math.min(mw/((BB.x1-BB.x0)*C0),mh/(BB.y1-BB.y0));
    proj.ox=box.x+(mw-(BB.x1-BB.x0)*C0*proj.s)/2;proj.oy=box.y+(mh-(BB.y1-BB.y0)*proj.s)/2;
    var tp=buildMap();
    if(mobile){
      var ty=box.y+mh+14;mtPos.style.cssText='left:'+gut+'px;width:'+(W-2*gut)+'px;top:'+ty+'px;height:'+Math.max(120,bottomLim-ty)+'px;align-items:start';
    }else{
      var tw=mw*0.56,th=mh*0.46;mtPos.style.cssText='left:'+(tp.textX-tw/2)+'px;top:'+(tp.textY-th/2)+'px;width:'+tw+'px;height:'+th+'px';
    }
    /* loop */
    L.cx=W/2;L.u=mobile?Math.min(W*0.43,H*0.25):Math.min(W*0.22,H*0.36);
    L.cy=tb+(bottomLim-tb)*(mobile?0.44:0.47);
    cap.style.top=(L.cy+L.u*0.5+(mobile?56:60))+'px';
    /* particles */
    var per=Math.max(60,Math.round(RLEN*L.u/3.4));L.per=per;
    var Nl=per*2,Nm=mapList.length,Nn=Math.max(Nl,Nm);
    if(Nn!==N||!P.x){N=Nn;initParticles()}
    fillLists(Nl,Nm);
    assign();
    var cur=SCENES[idx].m,prev=SCENES[(idx+NS-1)%NS].m;
    setProfiles(first?cur:prev,cur);
    if(!stars.length){for(var s=0;s<150;s++){stars.push({x:Math.random(),y:Math.random(),z:rnd(.25,1),p:rnd(0,TAU)})}}
    viewParams(clk);
    for(var i=0;i<N;i++){var t=target(i,cur,clk);P.x[i]=P.sx[i]=t[0];P.y[i]=P.sy[i]=t[1]}
    if(!first&&started)sceneT=Math.min(sceneT,clk-TRANS);
    if(reduce)render();
  }

  function initParticles(){
    var a=['x','y','sx','sy','ox','oy','f','dl','cv','sz0','al0','sz1','al1','z'];
    a.forEach(function(k){P[k]=new Float32Array(N)});
    P.s=new Uint8Array(N);P.mi=new Uint16Array(N);P.lreal=new Uint8Array(N);P.mreal=new Uint8Array(N);
    P.c0=new Uint8Array(N);P.c1=new Uint8Array(N);P.mk=new Uint8Array(N);P.mw=new Float32Array(N);
    for(var i=0;i<N;i++)P.cv[i]=rnd(-1,1);
  }
  var MX,MY,MK,MW,MR;
  function fillLists(Nl,Nm){
    for(var i=0;i<N;i++){
      var j=i%Nl;P.s[i]=j&1;P.f[i]=(j>>1)/L.per;P.lreal[i]=i<Nl?1:0;
    }
    MX=new Float32Array(N);MY=new Float32Array(N);MK=new Uint8Array(N);MW=new Float32Array(N);MR=new Uint8Array(N);
    var order=[],k;for(k=0;k<N;k++)order.push(k);
    for(k=0;k<N;k++){var m=mapList[k%Nm];MX[k]=m[0];MY[k]=m[1];MK[k]=m[2];MW[k]=m[3];MR[k]=k<Nm?1:0}
    order.sort(function(a,b){return MX[a]-MX[b]||MY[a]-MY[b]});
    M.n=N;M.x=new Float32Array(N);M.y=new Float32Array(N);M.k=new Uint8Array(N);M.w=new Float32Array(N);M.r=new Uint8Array(N);
    for(k=0;k<N;k++){var o=order[k];M.x[k]=MX[o];M.y[k]=MY[o];M.k[k]=MK[o];M.w[k]=MW[o];M.r[k]=MR[o]}
  }
  function assign(){
    // the loop unfolds into the map like a curtain: left-most loop dots go to left-most map dots
    var order=[],key=new Float32Array(N),i,a=[0,0,0];
    for(i=0;i<N;i++){order.push(i);ring3(tAt(P.f[i]),P.s[i],a);key[i]=a[0]}
    order.sort(function(p,q){return key[p]-key[q]});
    for(var r=0;r<N;r++){var pi=order[r];P.mi[pi]=r;P.dl[pi]=0.32*(r/N)}
  }

  function profile(i,mode,out){
    if(mode==='loop'){out[0]=mobile?2:2.3;out[1]=P.lreal[i]?.95:0;out[2]=P.s[i]?2:0}
    else{
      var m=P.mi[i],real=M.r[m];
      if(M.k[m]===0){out[0]=mobile?2.5:3.0;out[1]=real?.96:0;out[2]=0}
      else{out[0]=mobile?1.5:1.8;out[1]=real?.40*M.w[m]:0;out[2]=1}
    }
  }
  var tmp=[0,0,0];
  function setProfiles(fromM,toM){
    for(var i=0;i<N;i++){
      profile(i,fromM,tmp);P.sz0[i]=tmp[0];P.al0[i]=tmp[1];P.c0[i]=tmp[2];
      profile(i,toM,tmp);P.sz1[i]=tmp[0];P.al1[i]=tmp[1];P.c1[i]=tmp[2];
    }
  }
  var out2=[0,0];
  function target(i,mode,t){
    if(mode==='loop'){var g=ringPt(P.s[i],(P.f[i]+t*0.010)%1,t);out2[0]=g[0];out2[1]=g[1];P.z[i]=g[2];return out2}
    var m=P.mi[i];out2[0]=M.x[m];out2[1]=M.y[m];return out2;
  }

  function enter(i,instant){
    idx=((i%NS)+NS)%NS;
    var cur=SCENES[idx].m,from=first?cur:prevMode;
    for(var k=0;k<N;k++){P.sx[k]=P.x[k];P.sy[k]=P.y[k]}
    setProfiles(from,cur);
    fromModeStore=from;prevMode=cur;
    sceneT=clk;
    clearTimeout(stmTimer);
    stms.forEach(function(s){s.classList.remove('on')});
    var want=stms.filter(function(s){return +s.dataset.scene===idx})[0];
    stmTimer=setTimeout(function(){if(want)want.classList.add('on')},instant?100:first?900:1000);
  }

  function frame(now){
    if(!running)return;
    var dt=Math.min(0.05,(now-last)/1000||0.016);last=now;clk+=dt;
    update();render();
    requestAnimationFrame(frame);
  }
  function update(){
    var sc=SCENES[idx],total=(first?0:TRANS)+sc.hold,tS=clk-sceneT;
    if(started&&tS>total){first=false;enter(idx+1)}
    tS=clk-sceneT;
    curMode=SCENES[idx].m;fromMode=first||tS>TRANS?curMode:fromModeStore;
    pT=first?1:clamp(tS/TRANS,0,1);
    var curIsMap=curMode==='map',fromIsMap=fromMode==='map';
    if(curIsMap)mapW=sm(clamp((pT-.5)/.5,0,1));else mapW=fromIsMap?1-sm(clamp(pT/.45,0,1)):0;
    if(!curIsMap)loopW=first?1:sm(clamp((pT-.4)/.6,0,1));else loopW=fromIsMap?0:1-sm(clamp(pT/.45,0,1));
    introP=clamp((clk-introT)/2.6,0,1);
    viewParams(clk);
  }

  var RX,RY,RAL,RSZ,RC,RZ;
  function render(){
    ctx.clearRect(0,0,W,H);
    var mx=(mouse.x-W/2)/W,my=(mouse.y-H/2)/H;
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=STAR;
    for(var s=0;s<stars.length;s++){
      var st=stars[s],tw=.5+.5*Math.sin(clk*(.35+st.z*.5)+st.p);
      ctx.globalAlpha=(.1+.4*tw)*st.z*(LIGHT?.45:1);
      ctx.fillRect(Math.round(st.x*W-mx*12*st.z),Math.round(st.y*H*0.9-my*8*st.z),1,1);
    }
    if(!started&&!reduce){ctx.globalAlpha=1;return}
    if(!RX||RX.length!==N){RX=new Float32Array(N);RY=new Float32Array(N);RAL=new Float32Array(N);RSZ=new Float32Array(N);RC=new Uint8Array(N);RZ=new Float32Array(N)}
    var R=mobile?60:90,R2=R*R;
    var scanX=M.minX+((clk*0.12)%1.7-0.35)*(M.maxX-M.minX),scanW=(M.maxX-M.minX)*0.06;
    var needLoop=loopW>0.01||pT<1;
    for(var i=0;i<N;i++){
      var t=target(i,curMode,clk),tx=t[0],ty=t[1],x,y,e=1;
      if(pT<1){
        var lt=clamp((pT-P.dl[i])/0.7,0,1);e=eio(lt);
        var sx=P.sx[i],sy=P.sy[i],dx=tx-sx,dy=ty-sy,k=P.cv[i]*0.12;
        var mxp=(sx+tx)/2-dy*k,myp=(sy+ty)/2+dx*k,u=1-e;
        x=u*u*sx+2*u*e*mxp+e*e*tx;y=u*u*sy+2*u*e*myp+e*e*ty;
      }else{x=tx;y=ty}
      P.x[i]=x;P.y[i]=y;
      var rx=x-mouse.x,ry=y-mouse.y,d2=rx*rx+ry*ry,ox=0,oy=0;
      if(d2<R2&&d2>1){var dd=Math.sqrt(d2),f=1-dd/R;f*=f*14;ox=rx/dd*f;oy=ry/dd*f}
      P.ox[i]+=(ox-P.ox[i])*0.14;P.oy[i]+=(oy-P.oy[i])*0.14;
      var al=lerp(P.al0[i],P.al1[i],e),sz=lerp(P.sz0[i],P.sz1[i],e),c=e<.5?P.c0[i]:P.c1[i],z=0;
      /* depth: nearer parts of the loop are brighter and larger, which is what makes it read as 3D */
      if(needLoop){
        if(curMode==='loop'&&pT>=1){z=P.z[i]}
        else{var g=ringPt(P.s[i],(P.f[i]+clk*0.010)%1,clk);z=g[2]}
        var zn=clamp((z+1.0)/2.0,0,1),df=0.22+0.9*zn,sf=0.72+0.62*zn;
        if(curMode==='loop'){var q=pT<1?e:1;al*=lerp(1,df,q);sz*=lerp(1,sf,q)}
        else{al*=lerp(df,1,e);sz*=lerp(sf,1,e)}
      }
      if(first){var v=clamp((introP*1.2-P.f[i])/0.12,0,1);al*=v}
      if(curMode==='loop'&&!first||curMode==='loop'&&first){ // light travelling along the strands
        var wv=0.82+0.18*Math.sin(P.f[i]*TAU*4-clk*1.1+P.s[i]*1.6);al*=lerp(1,wv,loopW)
      }
      if(curMode==='map'&&e>=1){
        var m=P.mi[i];
        if(M.k[m]===0){var dsx=(x-scanX)/scanW;al=Math.min(1,al+Math.exp(-dsx*dsx)*0.45*mapW)}
        else al*=0.78+0.22*Math.sin(clk*0.9+i*0.37);
      }
      RX[i]=x+P.ox[i];RY[i]=y+P.oy[i];RAL[i]=al;RSZ[i]=sz;RC[i]=c;RZ[i]=z;
    }
    var lastC=-1,pass,loopNow=needLoop;
    for(pass=0;pass<(loopNow?2:1);pass++){
      for(i=0;i<N;i++){
        var a2=RAL[i];if(a2<=0.01)continue;
        if(loopNow&&((pass===0)!==(RZ[i]<0)))continue;
        c=RC[i];if(c!==lastC){ctx.fillStyle=PAL[c];lastC=c}
        ctx.globalAlpha=a2;var s2=RSZ[i];
        if(curMode==='map'){ctx.beginPath();ctx.arc(RX[i],RY[i],s2/2,0,TAU);ctx.fill()} // map dots are true circles
        else ctx.fillRect(RX[i]-s2/2,RY[i]-s2/2,s2,s2);
      }
    }
    if(loopW>0.01){
      for(var gI=0;gI<2;gI++){
        var gp=ringPt(gI,((clk*0.04+gI*0.5)%1+1)%1,clk),gx=gp[0],gy=gp[1],gz=gp[2];
        var gr=ctx.createRadialGradient(gx,gy,0,gx,gy,mobile?16:24),ga=(first?introP:1)*loopW*(gz>0?0.34:0.14);
        if(LIGHT)ga*=.55;gr.addColorStop(0,'rgba('+HALO+','+ga+')');gr.addColorStop(.4,'rgba('+HALO+','+ga*0.3+')');gr.addColorStop(1,'rgba('+HALO+',0)');
        ctx.globalAlpha=1;ctx.fillStyle=gr;ctx.fillRect(gx-30,gy-30,60,60);
      }
    }
    ctx.globalAlpha=1;
  }

  hero.addEventListener('pointermove',function(e){var r=hero.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top});
  hero.addEventListener('pointerleave',function(){mouse.x=mouse.y=-9999});
  var rz;window.addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(function(){if(P.x&&W===hero.clientWidth&&H===hero.clientHeight)return;layout()},120)});
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(en){
      var vis=en[0].isIntersecting;
      if(vis&&!running&&(started||reduce)){running=true;last=performance.now();requestAnimationFrame(frame)}
      else if(!vis){running=false}
    },{threshold:0}).observe(hero);
  }

  function start(){
    if(started)return;started=true;
    hero.classList.add('go');
    layout();
    if(reduce){
      idx=1;first=false;clk=10;prevMode='map';setProfiles('map','map');
      for(var i=0;i<N;i++){var t=target(i,'map',clk);P.x[i]=t[0];P.y[i]=t[1]}
      sceneT=clk-10;pT=1;curMode='map';fromMode='map';mapW=1;loopW=0;
      stms.forEach(function(s){s.classList.toggle('on',s.dataset.scene==='1')});
      render();return;
    }
    introT=clk+0.15;
    enter(0,false);
    sceneT=clk+2.4;
    running=true;last=performance.now();requestAnimationFrame(frame);
  }
  window.__heroStart=start;
  layout();
  if(!reduce){requestAnimationFrame(function f(){if(started)return;clk+=0.016;render();requestAnimationFrame(f)})}
  if(window.__preDone)start();
})();
