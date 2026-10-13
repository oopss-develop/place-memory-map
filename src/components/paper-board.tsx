"use client";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { CanvasTexture, DoubleSide, ShaderMaterial, SRGBColorSpace } from "three";
import { BOARD_HEIGHT, BOARD_WIDTH, resolveBoardPhoto, type BoardItem, type BoardPhotoOption } from "@/lib/memory-board";
import type { Visit } from "@/types/domain";

export interface PaperInteraction { id?: string; x: number; strength: number }
const vertexShader = `
  varying vec2 vUv; varying float vBend;
  uniform float uBend; uniform float uPointer; uniform float uPin;
  void main() {
    vUv = uv;
    vec3 p = position;
    float freeEdge = pow(1.0 - uv.y, 2.4);
    float side = mix(0.62, 1.0, smoothstep(0.0, 0.8, 1.0 - abs(uv.x - uPointer)));
    float pin = mix(1.0, 0.7 + abs(uv.x - 0.5), uPin);
    float bend = uBend * freeEdge * side * pin;
    p.z += bend;
    p.y += abs(bend) * 0.20;
    p.x += bend * (uv.x - 0.5) * 0.045;
    vBend = bend;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const fragmentShader = `
  uniform sampler2D uTexture; uniform float uBend; varying vec2 vUv; varying float vBend;
  void main() {
    vec4 color = texture2D(uTexture, vUv);
    float shade = 1.0 - clamp(abs(vBend) * 0.0028, 0.0, 0.18);
    gl_FragColor = vec4(color.rgb * shade, color.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const shadowFragment = `
  varying vec2 vUv; varying float vBend;
  void main() {
    float edge = smoothstep(0.0, 0.07, vUv.x) * smoothstep(0.0, 0.07, 1.0-vUv.x)
      * smoothstep(0.0, 0.07, vUv.y) * smoothstep(0.0, 0.07, 1.0-vUv.y);
    gl_FragColor = vec4(0.17,0.13,0.09,edge * (0.15-clamp(abs(vBend)*0.001,0.0,0.06)));
  }
`;
const colors = { cream: "#fff0ae", rose: "#f7d9d1", sage: "#dce6d1", sky: "#d9e7f0" };
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of paragraph) {
      if (ctx.measureText(line + char).width > width && line) { result.push(line); line = ""; }
      line += char;
    }
    result.push(line);
  }
  return result;
}
function Paper({ item, content, visit, order, interaction, reduced, onReady }: {
  item: BoardItem; content: BoardItem; visit: ReturnType<typeof resolveBoardPhoto>; order: number;
  interaction: PaperInteraction; reduced: boolean; onReady: (id: string, ready: boolean) => void;
}) {
  const { invalidate } = useThree();
  const spring = useRef({ position: 0, velocity: 0 });
  const paperRef = useRef<ShaderMaterial>(null);
  const shadowRef = useRef<ShaderMaterial>(null);
  const photoUrl = visit?.url;
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    let cancelled = false;
    let created: CanvasTexture | null = null;
    onReady(content.id, false);
    const draw = (image?: HTMLImageElement) => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      const resolution = Math.min(2, 512 / Math.max(content.width, content.height));
      canvas.width = Math.ceil(content.width * resolution); canvas.height = Math.ceil(content.height * resolution);
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      const scale = canvas.width / content.width;
      ctx.scale(scale, scale);
      ctx.fillStyle = content.kind === "note" ? colors[content.color] : "#fffdf7";
      ctx.fillRect(0, 0, content.width, content.height);
      ctx.fillStyle = "#39332c";
      if (image) {
        const w = content.width-20, h = content.height-48;
        const crop = Math.max(w/image.naturalWidth, h/image.naturalHeight);
        const sw=w/crop, sh=h/crop;
        ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,10,10,w,h);
        ctx.font = "12px sans-serif";
        ctx.fillText((content.text || visit?.place || "우리의 사진").slice(0,35),12,content.height-15,content.width-24);
      } else {
        ctx.font = `${content.kind === "note" ? 18 : 14}px sans-serif`;
        const text = content.kind === "note" ? content.text || "여기에 우리의 이야기를 남겨요." : "사진을 불러올 수 없어요";
        const available = Math.floor((content.height-56)/27);
        lines(ctx,text,content.width-38).slice(0,available).forEach((line,i)=>ctx.fillText(line,19,38+i*27));
      }
      created = new CanvasTexture(canvas); created.colorSpace = SRGBColorSpace;
      setTexture(created); onReady(content.id, true); invalidate();
    };
    if (content.kind === "photo" && photoUrl) {
      const image = new Image(); image.crossOrigin = "anonymous";
      image.onload = () => draw(image); image.onerror = () => draw();
      image.src = photoUrl;
    } else draw();
    return () => { cancelled=true; created?.dispose(); };
  }, [content.id, content.kind, content.color, content.text, content.width, content.height, photoUrl, visit?.place, invalidate, onReady]);
  const materials = useMemo(() => {
    const uniforms = () => ({ uTexture: { value: null }, uBend: { value: 0 }, uPointer: { value: 0.5 }, uPin: { value: item.attachment === "pin" ? 1 : 0 } });
    return {
      paper: new ShaderMaterial({ vertexShader, fragmentShader, uniforms: uniforms(), side: DoubleSide, transparent: true, depthWrite: false }),
      shadow: new ShaderMaterial({ vertexShader, fragmentShader: shadowFragment, uniforms: uniforms(), transparent: true, depthWrite: false }),
    };
  }, [item.attachment]);
  useEffect(() => () => { materials.paper.dispose(); materials.shadow.dispose(); }, [materials]);
  useFrame((_, delta) => {
    const s = spring.current;
    const target = !reduced && interaction.id === item.id ? 27 * interaction.strength : 0;
    // Substeps keep the damped paper motion stable after an inactive browser tab.
    const time = Math.min(delta, 0.05); const steps = 4; const dt = time/steps;
    for (let i=0;i<steps;i++) { s.velocity += ((target-s.position)*115-s.velocity*11)*dt; s.position+=s.velocity*dt; }
    if (reduced) { s.position=0; s.velocity=0; }
    for (const material of [paperRef.current,shadowRef.current]) {
      if (!material) continue;
      material.uniforms.uBend.value=s.position; material.uniforms.uPointer.value=interaction.id===item.id ? interaction.x : 0.5;
    }
    if (paperRef.current) paperRef.current.uniforms.uTexture.value=texture;
    if (Math.abs(target-s.position)>0.015 || Math.abs(s.velocity)>0.015) invalidate();
  });
  if (!texture) return null;
  return <group position={[item.x+item.width/2-BOARD_WIDTH/2, BOARD_HEIGHT/2-item.y-item.height/2, order*2]} rotation={[0,0,-item.rotation*Math.PI/180]}>
    <mesh position={[5,-8,-0.8]} renderOrder={order*5}><planeGeometry args={[item.width+12,item.height+12,24,24]} /><primitive ref={shadowRef} object={materials.shadow} attach="material" /></mesh>
    <mesh renderOrder={order*5+1}><planeGeometry args={[item.width,item.height,32,32]} /><primitive ref={paperRef} object={materials.paper} attach="material" /></mesh>
    {item.attachment === "tape" ? <group position={[0,item.height/2-2,1]} rotation={[0,0,3*Math.PI/180]}>
      <mesh position={[1,-2,-0.1]} renderOrder={order*5+2}><planeGeometry args={[88,30]}/><meshBasicMaterial color="#5d4825" transparent opacity={0.09} depthWrite={false} depthTest={false}/></mesh>
      <mesh renderOrder={order*5+3}><planeGeometry args={[88,30]}/><meshBasicMaterial color="#d3b777" transparent opacity={0.83} depthWrite={false} depthTest={false}/></mesh>
    </group> : <group position={[0,item.height/2-3.5,1]}>
      <mesh position={[2,-3,-0.1]} renderOrder={order*5+2}><circleGeometry args={[8,24]}/><meshBasicMaterial color="#3c2719" transparent opacity={0.25} depthWrite={false} depthTest={false}/></mesh>
      <mesh renderOrder={order*5+3}><circleGeometry args={[7.5,24]}/><meshBasicMaterial color="#92563e" transparent depthWrite={false} depthTest={false}/></mesh>
      <mesh position={[-2,2,0.1]} renderOrder={order*5+4}><circleGeometry args={[2.2,16]}/><meshBasicMaterial color="#d4a890" transparent depthWrite={false} depthTest={false}/></mesh>
    </group>}
  </group>;
}
class GraphicsBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
function Redraw({ interaction }: { interaction: PaperInteraction }) {
  const invalidate = useThree(state=>state.invalidate);
  useEffect(()=>invalidate(),[interaction,invalidate]);
  return null;
}
export default function PaperBoard({ items, drawingItems, visits, uploads, interaction, reduced, onReady, onFailure }: {
  items: BoardItem[]; drawingItems: BoardItem[]; visits: Visit[]; uploads: BoardPhotoOption[]; interaction: PaperInteraction; reduced: boolean;
  onReady: (id: string, ready: boolean) => void; onFailure: () => void;
}) {
  return <GraphicsBoundary onFailure={onFailure}><Canvas resize={{ offsetSize: true }} orthographic frameloop="demand" dpr={[1,1.5]} gl={{ alpha: true, antialias: true }}
    fallback={<span hidden>종이 효과를 사용할 수 없어 기본 사진으로 표시합니다.</span>}
    onCreated={({ gl })=>{ gl.setClearColor(0x000000,0); gl.domElement.addEventListener("webglcontextlost",onFailure,{once:true}); }}>
    <OrthographicCamera makeDefault manual position={[0,0,1000]} left={-BOARD_WIDTH/2} right={BOARD_WIDTH/2} top={BOARD_HEIGHT/2} bottom={-BOARD_HEIGHT/2} near={0.1} far={2000} />
    <Redraw interaction={interaction} />
    {items.map((item,index)=><Paper key={item.id} item={item} content={drawingItems.find(content=>content.id===item.id) ?? item} visit={resolveBoardPhoto(item,visits,uploads)} order={index} interaction={interaction} reduced={reduced} onReady={onReady} />)}
  </Canvas></GraphicsBoundary>;
}
