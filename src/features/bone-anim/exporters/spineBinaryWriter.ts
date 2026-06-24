// Spine 4.x .skel 二进制写入工具
// 仅供 spineSkelExporter 使用。基于 Spine 二进制格式公开 spec：
//   string: varint+ 长度，0=null，1=empty，否则 len-1 字节 UTF-8
//   ref string: varint+ 索引（共享字符串表），0=null
//   varint+ / varint-: 7 位 group，MSB 表示后续；负值预先 zigzag 编码
//   color: int RGBA8888
//   short / int: big-endian
//
// 这只是 encoder。读取由 Spine runtime 完成。

export class SpineBinaryWriter {
  private chunks: Uint8Array[] = [];
  private encoder = new TextEncoder();

  writeByte(value: number) {
    const buf = new Uint8Array(1);
    buf[0] = value & 0xff;
    this.chunks.push(buf);
  }

  writeBoolean(value: boolean) {
    this.writeByte(value ? 1 : 0);
  }

  writeShort(value: number) {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setInt16(0, value, false);
    this.chunks.push(buf);
  }

  writeInt(value: number) {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setInt32(0, value | 0, false);
    this.chunks.push(buf);
  }

  writeFloat(value: number) {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setFloat32(0, value, false);
    this.chunks.push(buf);
  }

  // varint 的非负正变体；最多 5 字节
  writeVarintPositive(value: number) {
    let v = value >>> 0;
    while (v >= 0x80) {
      this.writeByte((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    this.writeByte(v & 0x7f);
  }

  // varint 的有符号变体（spec 中称 varint-）；用 zigzag 让小的负数也只占一两个字节
  writeVarintSigned(value: number) {
    const z = (value << 1) ^ (value >> 31);
    this.writeVarintPositive(z >>> 0);
  }

  writeString(value: string | null | undefined) {
    if (value == null) {
      this.writeVarintPositive(0); // null
      return;
    }
    if (value.length === 0) {
      this.writeVarintPositive(1); // empty
      return;
    }
    const bytes = this.encoder.encode(value);
    this.writeVarintPositive(bytes.length + 1);
    this.chunks.push(bytes);
  }

  writeColor(rgba: number) {
    this.writeInt(rgba | 0);
  }

  writeRefString(index: number) {
    // 0 = null；1-based
    this.writeVarintPositive(index | 0);
  }

  toBuffer(): Uint8Array {
    let total = 0;
    for (const c of this.chunks) total += c.length;
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
}

// 共享字符串表：按 string 出现顺序累积；写入头部 ref string 部分；
// 后续 ref string 引用 1-based 索引
export class SharedStringTable {
  private map = new Map<string, number>();
  private list: string[] = [];

  intern(str: string | null | undefined): number {
    if (str == null) return 0;
    const existing = this.map.get(str);
    if (existing) return existing;
    this.list.push(str);
    const idx = this.list.length;
    this.map.set(str, idx);
    return idx;
  }

  asList(): string[] {
    return this.list.slice();
  }
}
