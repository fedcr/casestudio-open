// Esportazione: STL binario, 3MF in stile Bambu Studio, preset JSON per A1 mini.

// ---------- ZIP (store, senza compressione) ----------
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

export function zip(files) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nameB = enc.encode(name);
    const body = typeof data === 'string' ? enc.encode(data) : data;
    const crc = crc32(body);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, body.length, true);
    lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameB, body);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, body.length, true);
    ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + body.length;
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/octet-stream' });
}

// ---------- STL ----------
export function stl(buf, name = 'part') {
  const { pos, idx } = buf;
  const n = idx.length / 3;
  const ab = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(ab);
  new TextEncoder().encodeInto(name.slice(0, 70), new Uint8Array(ab, 0, 80));
  dv.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < n; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    let q = o + 12;
    for (const v of [a, b, c]) { dv.setFloat32(q, pos[v], true); dv.setFloat32(q + 4, pos[v + 1], true); dv.setFloat32(q + 8, pos[v + 2], true); q += 12; }
    o += 50; // 12 normale + 36 vertici + 2 attributo
  }
  return new Blob([ab], { type: 'model/stl' });
}

// ---------- 3MF (Bambu Studio) ----------
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function bounds(pos) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  return { mn, mx };
}

export const PRINT = {
  tpu: {
    filament: 'Generic TPU @BBL A1M', filamentLabel: 'TPU 95A',
    temp: 230, vol: 3.2
  },
  pla: {
    filament: 'Generic PLA @BBL A1M', filamentLabel: 'PLA',
    temp: 220, vol: 15
  }
};

export function processPreset(kind, name) {
  const tpu = kind === 'tpu';
  return {
    type: 'process', name, from: 'User', inherits: '0.20mm Standard @BBL A1M', version: '1.9.0.0',
    print_settings_id: name,
    compatible_printers: ['Bambu Lab A1 mini 0.4 nozzle'],
    layer_height: '0.2', initial_layer_print_height: '0.2',
    wall_loops: tpu ? '3' : '3',
    top_shell_layers: tpu ? '3' : '4', bottom_shell_layers: tpu ? '3' : '4',
    sparse_infill_density: tpu ? '15%' : '20%', sparse_infill_pattern: 'gyroid',
    enable_support: '0',
    brim_type: tpu ? 'outer_only' : 'no_brim', brim_width: '4',
    seam_position: tpu ? 'aligned' : 'back',
    outer_wall_speed: tpu ? '30' : '120', inner_wall_speed: tpu ? '40' : '160',
    sparse_infill_speed: tpu ? '40' : '200', internal_solid_infill_speed: tpu ? '40' : '160',
    top_surface_speed: tpu ? '30' : '80', initial_layer_speed: tpu ? '20' : '40',
    bridge_speed: tpu ? '20' : '40', bridge_flow: tpu ? '0.95' : '0.9',
    default_acceleration: tpu ? '2000' : '5000', outer_wall_acceleration: tpu ? '1500' : '3000',
    ironing_type: 'no ironing'
  };
}
export function filamentPreset(kind, name) {
  const f = PRINT[kind];
  const arr = v => [String(v)];
  return {
    type: 'filament', name, from: 'User', inherits: f.filament, version: '1.9.0.0',
    filament_settings_id: arr(name),
    compatible_printers: ['Bambu Lab A1 mini 0.4 nozzle'],
    nozzle_temperature: arr(f.temp), nozzle_temperature_initial_layer: arr(f.temp),
    filament_max_volumetric_speed: arr(f.vol),
    fan_min_speed: arr(kind === 'tpu' ? 60 : 100), fan_max_speed: arr(kind === 'tpu' ? 80 : 100),
    ...(kind === 'tpu' ? { filament_retraction_length: ['0.4'], filament_retraction_speed: ['25'], filament_deretraction_speed: ['25'], textured_plate_temp: ['35'], hot_plate_temp: ['35'], cool_plate_temp: ['35'] } : {})
  };
}

export function threeMF(buf, { name, kind, pauses = [], layerNames = {} }) {
  const { pos, idx } = buf;
  const { mn, mx } = bounds(pos);
  const sx = mx[0] - mn[0], sy = mx[1] - mn[1];
  // centra sul piano 180x180 e appoggia a z=0
  const tx = 90 - (mn[0] + mx[0]) / 2, ty = 90 - (mn[1] + mx[1]) / 2, tz = -mn[2];
  let v = '', t = '';
  for (let i = 0; i < pos.length; i += 3) v += `<vertex x="${pos[i].toFixed(4)}" y="${pos[i + 1].toFixed(4)}" z="${pos[i + 2].toFixed(4)}"/>`;
  for (let i = 0; i < idx.length; i += 3) t += `<triangle v1="${idx[i]}" v2="${idx[i + 1]}" v3="${idx[i + 2]}"/>`;
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">
 <metadata name="Application">BambuStudio-02.00.00.00</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${esc(name)}</metadata>
 <metadata name="Designer">CaseStudio Open</metadata>
 <resources>
  <object id="1" name="${esc(name)}" type="model">
   <mesh><vertices>${v}</vertices><triangles>${t}</triangles></mesh>
  </object>
 </resources>
 <build>
  <item objectid="1" transform="1 0 0 0 1 0 0 0 1 ${tx.toFixed(3)} ${ty.toFixed(3)} ${tz.toFixed(3)}" printable="1"/>
 </build>
</model>`;
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/><Default Extension="xml" ContentType="text/xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
    '3D/3dmodel.model': model,
    'Metadata/model_settings.config': `<?xml version="1.0" encoding="UTF-8"?>
<config>
 <object id="1">
  <metadata key="name" value="${esc(name)}"/>
  <metadata key="extruder" value="1"/>
 </object>
 <plate>
  <metadata key="plater_id" value="1"/>
  <metadata key="plater_name" value=""/>
  <metadata key="locked" value="false"/>
  <model_instance>
   <metadata key="object_id" value="1"/>
   <metadata key="instance_id" value="0"/>
  </model_instance>
 </plate>
</config>`,
    'Metadata/project_settings.config': JSON.stringify({
      from: 'project', name: 'project_settings',
      printer_settings_id: 'Bambu Lab A1 mini 0.4 nozzle',
      filament_settings_id: [PRINT[kind].filament],
      print_settings_id: '0.20mm Standard @BBL A1M',
      ...Object.fromEntries(Object.entries(processPreset(kind, 'x')).filter(([k]) => !['type', 'name', 'from', 'inherits', 'version', 'print_settings_id', 'compatible_printers'].includes(k))),
      nozzle_temperature: [String(PRINT[kind].temp)], nozzle_temperature_initial_layer: [String(PRINT[kind].temp)],
      filament_max_volumetric_speed: [String(PRINT[kind].vol)]
    }, null, 2)
  };
  if (pauses.length) {
    const rows = pauses.map(p => p.type === 'pause'
      ? `<layer top_z="${p.top_z}" type="1" extruder="1" color="" extra="${esc(p.msg)}" gcode="pause_print"/>`
      : `<layer top_z="${p.top_z}" type="0" extruder="1" color="#1F5FD6" extra="${esc(p.msg)}" gcode="color_change"/>`).join('\n');
    files['Metadata/custom_gcode_per_layer.xml'] = `<?xml version="1.0" encoding="utf-8"?>
<custom_gcodes_per_layer>
<plate>
<plate_info id="1"/>
${rows}
</plate>
<mode value="SingleExtruder"/>
</custom_gcodes_per_layer>`;
  }
  return { blob: zip(files), fits: sx <= 180 && sy <= 180, size: [sx, sy, mx[2] - mn[2]] };
}

export function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
export const jsonBlob = o => new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' });
