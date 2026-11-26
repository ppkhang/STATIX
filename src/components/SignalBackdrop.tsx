"use client";

import { useEffect, useRef } from "react";
import styles from "./backdrop.module.css";

const GRAPHIC = "/assets/static-waves.svg";

// all distances are in the graphic's own units (its canvas is 1600 x 900)
const TOUCH = 10; // a line this close to the pointer is fully lit...
const REACH = 40; // ...fading to nothing here. Raise both to light more lines at once.
const FALLOFF = 280; // how far along a line the brightness travels from the pointer
const REST = 0.34; // how much of its own strength a contour line or dot keeps when it isn't lit
const MARGIN = REACH + 30; // first rough pass: covers how far the animations move a line
const SPACING = 10; // distance between the points sampled along each line
// random glows, besides the one at the pointer
const SPARKS = 6; // at most this many at once
const SPARK_GAP = [150, 500]; // milliseconds between one starting and the next
const SPARK_LIFE = [2200, 4200]; // how long one takes to fade in and out
const between = ([low, high]: number[]) => low + Math.random() * (high - low);
// brightness along the gradient: [offset, share of the boost]. No flat top and no hard rim.
const CURVE = [[0, 1], [0.25, 0.7], [0.5, 0.35], [0.75, 0.12], [1, 0]] as const;

type Line = {
  shape: SVGGeometryElement;
  gradient: SVGRadialGradientElement;
  stops: SVGStopElement[];
  colour: string;
  rest: number;
  points: Float32Array;
  level: number; // what is painted now
  hover: number; // the part that comes from the pointer
};

/** The stops for a line at `level`, from 0 (flat resting look) to 1 (fully lit at the centre). */
function shade(line: Line, level: number) {
  line.level = level;
  line.stops.forEach((stop, i) => {
    const boost = level * CURVE[i][1];
    stop.setAttribute("stop-opacity", (line.rest + boost * (1 - line.rest)).toFixed(3));
    stop.style.stopColor = boost > 0 ? `color-mix(in srgb, ${line.colour}, #fff ${(boost * 45).toFixed(1)}%)` : line.colour;
  });
}

/** Gives every shape its own gradient, and samples points along it for finding the pointer. */
function prepare(svg: SVGSVGElement): Line[] {
  const make = <K extends keyof SVGElementTagNameMap>(name: K) => document.createElementNS("http://www.w3.org/2000/svg", name);
  const found = [...svg.querySelectorAll<SVGGeometryElement>("path, line, circle")].map((shape) => {
    const look = getComputedStyle(shape); // all read before anything is repainted
    const stroked = look.stroke !== "none";
    return { shape, stroked, colour: stroked ? look.stroke : look.fill, rest: (stroked ? Number(look.strokeOpacity) : 1) * REST };
  });
  const defs = make("defs");
  svg.prepend(defs);

  return found.map(({ shape, stroked, colour, rest }, index) => {
    const gradient = make("radialGradient");
    gradient.id = `signal-line-${index}`;
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    gradient.setAttribute("r", String(FALLOFF));
    const stops = CURVE.map(([offset]) => {
      const stop = make("stop");
      stop.setAttribute("offset", String(offset));
      gradient.append(stop);
      return stop;
    });
    defs.append(gradient);

    const length = shape.getTotalLength();
    const count = Math.max(2, Math.ceil(length / SPACING) + 1);
    const points = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const point = shape.getPointAtLength((length * i) / (count - 1));
      points[i * 2] = point.x;
      points[i * 2 + 1] = point.y;
    }

    const line: Line = { shape, gradient, stops, colour, rest, points, level: 0, hover: 0 };
    shade(line, 0);
    shape.style.setProperty(stroked ? "stroke" : "fill", `url(#${gradient.id})`);
    shape.style.setProperty(stroked ? "stroke-opacity" : "fill-opacity", "1"); // the stops carry the strength
    return line;
  });
}

type Spark = { line: Line; x: number; y: number; start: number; life: number; peak: number };

/** A random spot on a random line that can be seen: on screen and not behind the form. Null if unlucky. */
function pickSpark(lines: Line[], area: Element, now: number): Spark | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const line = lines[Math.floor(Math.random() * lines.length)];
    const i = Math.floor(Math.random() * (line.points.length / 2)) * 2;
    const x = line.points[i], y = line.points[i + 1];
    const toScreen = line.shape.getScreenCTM();
    if (!toScreen) return null;
    const at = new DOMPoint(x, y).matrixTransform(toScreen);
    // the backdrop ignores the pointer, so a bare spot hit-tests as the area behind the form
    if (document.elementFromPoint(at.x, at.y) === area) {
      return { line, x, y, start: now, life: between(SPARK_LIFE), peak: between([0.6, 1]) };
    }
  }
  return null;
}

function distanceTo(points: Float32Array, at: DOMPoint) {
  let nearest = Infinity;
  for (let i = 0; i < points.length; i += 2) {
    const squared = (points[i] - at.x) ** 2 + (points[i + 1] - at.y) ** 2;
    if (squared < nearest) nearest = squared;
  }
  return Math.sqrt(nearest);
}

/**
 * public/assets/static-waves.svg, inline so CSS can animate its parts. The line or two under the pointer
 * light up, brightest beside it and fading along the line, and now and then a random spot glows on its own.
 * Nothing is laid over the graphic.
 * The styles rely on the file's groups: topology, nodes.
 */
export default function SignalBackdrop() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const holder = root.current!;
    let stopped = false;
    let lines: Line[] = [];

    // our own static file, so it is safe to put in the page as markup
    fetch(GRAPHIC)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
      .then((text) => {
        if (stopped) return;
        holder.innerHTML = text;
        const svg = holder.querySelector("svg")!;
        svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
        // ids become data attributes so they can't clash with the page's; --i staggers each part
        for (const group of svg.querySelectorAll<SVGGElement>("g[id]")) {
          group.dataset.part = group.id;
          group.removeAttribute("id");
          [...group.children].forEach((child, i) => {
            const style = (child as SVGElement).style;
            if (!style.getPropertyValue("--i")) style.setProperty("--i", String(i)); // contour lines bring their own
          });
        }
        lines = prepare(svg);
      })
      .catch((error) => console.warn("Backdrop graphic did not load", error)); // decoration only

    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let sparks: Spark[] = [];
    // once per frame, and only while something is lit or the pointer is over the page
    const update = (now: number) => {
      frame = 0;
      const toGraphic = pointer && holder.querySelector("svg")?.getScreenCTM()?.inverse();
      const rough = pointer && toGraphic ? new DOMPoint(pointer.x, pointer.y).matrixTransform(toGraphic) : null;
      sparks = sparks.filter((spark) => now - spark.start < spark.life);
      const sparking = new Map(sparks.map((spark) => {
        const t = Math.max(0, (now - spark.start) / spark.life);
        return [spark.line, { ...spark, level: spark.peak * Math.sin(Math.PI * t) ** 2 }];
      }));
      let busy = sparks.length > 0;
      for (const line of lines) {
        let target = 0;
        let under: DOMPoint | null = null;
        if (pointer && rough && distanceTo(line.points, rough) < MARGIN) {
          // measured in the line's own space, which includes wherever its animation has moved it
          const own = line.shape.getScreenCTM()?.inverse();
          if (own) {
            const at = new DOMPoint(pointer.x, pointer.y).matrixTransform(own);
            const near = Math.min(1, Math.max(0, (REACH - distanceTo(line.points, at)) / (REACH - TOUCH)));
            target = near * near * (3 - 2 * near);
            if (target > 0) under = at;
          }
        }
        const spark = sparking.get(line);
        if (!spark && target === 0 && line.hover === 0 && line.level === 0) continue; // untouched lines are never written to
        line.hover = calm.matches ? target : line.hover + (target - line.hover) * 0.25;
        if (Math.abs(target - line.hover) < 0.01) line.hover = target;
        // a line has one bright spot: whichever of the pointer and a random glow is stronger places it
        const sparkLevel = spark?.level ?? 0;
        const centre = spark && sparkLevel > line.hover ? spark : under;
        if (centre) {
          line.gradient.setAttribute("cx", centre.x.toFixed(1));
          line.gradient.setAttribute("cy", centre.y.toFixed(1));
        }
        const level = Math.max(line.hover, sparkLevel);
        if (level !== line.level) shade(line, level);
        if (line.hover > 0 || level > 0) busy = true; // keep following: the lines move under a resting pointer
      }
      if (busy) schedule();
    };
    const schedule = () => { frame ||= requestAnimationFrame(update); };

    let spawner: ReturnType<typeof setTimeout>;
    const spawn = () => {
      if (!calm.matches && !document.hidden && lines.length && sparks.length < SPARKS) {
        const spark = pickSpark(lines, holder.parentElement!, performance.now());
        if (spark && !sparks.some((other) => other.line === spark.line)) {
          sparks.push(spark);
          schedule();
        }
      }
      spawner = setTimeout(spawn, between(SPARK_GAP));
    };
    spawner = setTimeout(spawn, 600);

    const follow = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY }; schedule(); };
    const dim = () => { pointer = null; schedule(); };
    // a lifted finger or a pointer that left the window switches the lines off
    const lifted = (event: PointerEvent) => { if (event.pointerType !== "mouse") dim(); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pointermove", follow);
    window.addEventListener("pointerdown", follow);
    window.addEventListener("pointerup", lifted);
    window.addEventListener("pointercancel", dim);
    document.documentElement.addEventListener("pointerleave", dim);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      clearTimeout(spawner);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pointermove", follow);
      window.removeEventListener("pointerdown", follow);
      window.removeEventListener("pointerup", lifted);
      window.removeEventListener("pointercancel", dim);
      document.documentElement.removeEventListener("pointerleave", dim);
    };
  }, []);

  return <div ref={root} className={styles.backdrop} aria-hidden="true" />;
}
