import polygonClipping from "polygon-clipping";
import { getRoomGeometryZones, validateRoomGeometry } from "./room.js";

const EPSILON = 1e-7;

export function roomFootprint(geometry) {
  const error = validateRoomGeometry(geometry);
  if (error) throw new TypeError(error);
  const zonePolygons = getRoomGeometryZones(geometry).map((zone) => [zone.boundary]);
  const union = zonePolygons.length === 1 ? [zonePolygons[0]] : polygonClipping.union(...zonePolygons);
  const exclusions = getRoomGeometryZones(geometry).flatMap((zone) => [
    ...(zone.openings || []),
    ...(zone.obstacles || []),
  ].map((entry) => [entry.boundary]));
  if (!exclusions.length) return union;
  const exclusionUnion = exclusions.length === 1 ? [exclusions[0]] : polygonClipping.union(...exclusions);
  return polygonClipping.difference(union, exclusionUnion);
}

export function rectanglePolygon(x, y, width, height) {
  return [[
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ]];
}

export function intersectWithRectangle(multiPolygon, x, y, width, height) {
  return polygonClipping.intersection(multiPolygon, rectanglePolygon(x, y, width, height));
}

export function subtractMultiPolygon(subject, ...clips) {
  if (!clips.length) return subject;
  return polygonClipping.difference(subject, ...clips);
}

export function unionMultiPolygons(...geometries) {
  const nonEmpty = geometries.filter((geometry) => geometry.length);
  if (!nonEmpty.length) return [];
  if (nonEmpty.length === 1) return nonEmpty[0];
  return polygonClipping.union(...nonEmpty);
}

export function multiPolygonArea(multiPolygon) {
  return multiPolygon.reduce((area, polygon) => {
    if (!polygon.length) return area;
    const ringArea = (ring) => Math.abs(ring.reduce((sum, point, index) => {
      const next = ring[(index + 1) % ring.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2);
    return area + ringArea(polygon[0]) - polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
  }, 0);
}

export function multiPolygonBounds(multiPolygon) {
  const points = multiPolygon.flat(2);
  if (!points.length) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, widthMm: maxX - minX, lengthMm: maxY - minY };
}

export function transformMultiPolygon(multiPolygon, transformPoint) {
  return multiPolygon.map((polygon) => polygon.map((ring) => ring.map(transformPoint)));
}

export function translateMultiPolygon(multiPolygon, dx, dy) {
  return transformMultiPolygon(multiPolygon, ([x, y]) => [x + dx, y + dy]);
}

export function rotateMultiPolygon(multiPolygon, angleRadians, originX, originY) {
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  return transformMultiPolygon(multiPolygon, ([x, y]) => {
    const dx = x - originX;
    const dy = y - originY;
    return [originX + dx * cosine - dy * sine, originY + dx * sine + dy * cosine];
  });
}

export function isFullTile(fragment, tileArea) {
  return Math.abs(multiPolygonArea(fragment) - tileArea) <= Math.max(EPSILON, tileArea * 1e-10);
}
