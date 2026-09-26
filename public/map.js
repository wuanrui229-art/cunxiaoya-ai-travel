import { translateText } from "./i18n.js";
const centers = {
  珠海: [113.576, 22.271],
  杭州: [120.155, 30.274],
  成都: [104.066, 30.572],
  桂林: [110.29, 25.274],
  婺源: [117.861, 29.248],
};
let travelMap, pendingCity;
const mapStyle = () =>
  "https://tiles.openfreemap.org/styles/" +
  (document.documentElement.dataset.theme === "light" ? "positron" : "dark");
export function focusMap(city) {
  pendingCity = city;
  const input = document.getElementById("map-city");
  const caption = document.querySelector(".map-caption span:last-child");
  if (caption)
    caption.textContent = centers[city]
      ? "城市范围参考 · 非村落导航点"
      : "该地区尚无核实坐标，地图仅供概览";
  if (input && [...input.options].some((o) => o.value === city))
    input.value = city;
  if (!centers[city]) travelMap?.jumpTo({ center: [104, 35], zoom: 3 });
  if (centers[city]) {
    if (input) input.value = city;
    travelMap?.flyTo({
      center: centers[city],
      zoom: 8,
      duration: 800,
      essential: false,
    });
  }
}
export async function initMap(onCity) {
  const pane = document.getElementById("map-pane"),
    fallback = document.getElementById("map-fallback");
  const toggle = document.getElementById("map-toggle");
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("show-map");
    toggle.setAttribute("aria-expanded", String(open));
    travelMap?.resize();
  });
  document.getElementById("map-city").addEventListener("change", (ev) => {
    const city = ev.target.value;
    if (city === "all") reset();
    else {
      focusMap(city);
      onCity(city);
    }
  });
  function reset() {
    document.getElementById("map-city").value = "all";
    travelMap?.fitBounds(
      [
        [102.2, 20.8],
        [123.2, 33],
      ],
      { padding: 65, duration: 600 },
    );
  }
  document.getElementById("map-reset").addEventListener("click", reset);
  const fail = () => {
    fallback.hidden = false;
    fallback.querySelector("h2").textContent = "地图暂时无法加载";
  };
  // The rest of the experience remains usable without WebGL or remote map tiles.
  try {
    if (!window.WebGLRenderingContext) {
      fail();
      return;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "./vendor/maplibre-gl.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    const lib = window.maplibregl;
    travelMap = new lib.Map({
      container: "travel-map",
      style: mapStyle(),
      center: [112.8, 27],
      zoom: 4.4,
      attributionControl: true,
    });
    window.addEventListener("themechange", () => {
      travelMap.setStyle(mapStyle());
    });
    travelMap.addControl(
      new lib.NavigationControl({ showCompass: true }),
      "bottom-right",
    );
    let ready = false;
    const timeout = setTimeout(() => {
      if (!ready) fail();
    }, 14000);
    travelMap.on("load", () => {
      ready = true;
      clearTimeout(timeout);
      fallback.hidden = true;
      if (pendingCity) focusMap(pendingCity);
    });
    travelMap.on("error", () => {
      if (!ready) fail();
    });
    for (const [city, coordinates] of Object.entries(centers)) {
      const marker = document.createElement("button");
      marker.className = "city-marker";
      marker.textContent = translateText(city);
      marker.setAttribute(
        "aria-label",
        translateText("查看城市范围") + " " + translateText(city),
      );
      marker.addEventListener("click", () => {
        focusMap(city);
        onCity(city);
      });
      new lib.Marker({ element: marker })
        .setLngLat(coordinates)
        .addTo(travelMap);
      document
        .getElementById("language-toggle")
        .addEventListener("click", () => {
          marker.textContent = translateText(city);
          marker.setAttribute(
            "aria-label",
            translateText("查看城市范围") + " " + translateText(city),
          );
        });
    }
    new ResizeObserver(() => travelMap.resize()).observe(pane);
  } catch {
    fail();
  }
}
