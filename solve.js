// csv-reader-speed-01-run-20261121: a faster drop-in for csv-reader 1.0.0.
// Written from scratch against the reference semantics in the kit (RULES.txt
// and baselines/csv-reader/vendor/csv-reader/index.js). Same answers, no
// per-character loop: unquoted fields are cut out with a single regex
// delimiter search (/[,\r\n]/g exec) plus slice, quoted fields find their
// closing quote with indexOf, and the slow paths (stray CR, multiline or
// doubled quotes, unterminated quotes) only run when the input actually
// contains them.

/** csv-reader 1.0.0's answer for one case's input, faster. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  const delim = /[,\r\n]/g;

  // ended: 0 = comma, 1 = line break, 2 = end of text
  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === '\n') {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = 0;
    let quoted = false;

    do {
      quoted = text.charCodeAt(pos) === 34;
      let value;
      if (!quoted) {
        // --- unquoted field: cut to the next comma / LF / CR ---
        let acc = null; // non-null once a stray CR forced a segment join
        let added = 0;
        let seg = pos;
        for (;;) {
          delim.lastIndex = pos;
          const dm = delim.exec(text);
          let j = -1;
          let k = 0;
          if (dm !== null) {
            j = dm.index;
            const dc = text.charCodeAt(dm.index);
            k = dc === 44 ? 0 : dc === 10 ? 1 : 2;
          }
          if (j === -1) {
            added += n - seg;
            value = acc === null ? text.slice(seg) : acc + text.slice(seg);
            pos = n;
            ended = 2;
            break;
          }
          if (k === 0) {
            added += j - seg;
            value = acc === null ? text.slice(seg, j) : acc + text.slice(seg, j);
            pos = j + 1;
            ended = 0;
            break;
          }
          if (k === 1) {
            added += j - seg;
            value = acc === null ? text.slice(seg, j) : acc + text.slice(seg, j);
            pos = j + 1;
            line += 1;
            ended = 1;
            break;
          }
          // CR: CRLF ends the record, a lone CR is dropped (stray_cr).
          if (text.charCodeAt(j + 1) === 10) {
            added += j - seg;
            value = acc === null ? text.slice(seg, j) : acc + text.slice(seg, j);
            pos = j + 2;
            line += 1;
            ended = 1;
            break;
          }
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          added += j - seg;
          acc = acc === null ? text.slice(seg, j) : acc + text.slice(seg, j);
          pos = j + 1;
          seg = pos;
        }
        fields.push(value);
        continue;
      }

      // --- quoted field: opening quote at pos ---
      const open = pos;
      const openLine = line;
      let q = text.indexOf('"', pos + 1);
      let hasDouble = false;
      while (q !== -1 && text.charCodeAt(q + 1) === 34) {
        hasDouble = true;
        q = text.indexOf('"', q + 2);
      }
      if (q === -1) {
        // The quote never closes: literal character, text after it read
        // again as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        // Re-read as unquoted with the opening quote as the initial value.
        let acc = '"';
        let seg = pos;
        for (;;) {
          delim.lastIndex = pos;
          const dm = delim.exec(text);
          let j = -1;
          let k = 0;
          if (dm !== null) {
            j = dm.index;
            const dc = text.charCodeAt(dm.index);
            k = dc === 44 ? 0 : dc === 10 ? 1 : 2;
          }
          if (j === -1) {
            value = acc + text.slice(seg);
            pos = n;
            ended = 2;
            break;
          }
          if (k === 0) {
            value = acc + text.slice(seg, j);
            pos = j + 1;
            ended = 0;
            break;
          }
          if (k === 1) {
            value = acc + text.slice(seg, j);
            pos = j + 1;
            line += 1;
            ended = 1;
            break;
          }
          if (text.charCodeAt(j + 1) === 10) {
            value = acc + text.slice(seg, j);
            pos = j + 2;
            line += 1;
            ended = 1;
            break;
          }
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          acc += text.slice(seg, j);
          pos = j + 1;
          seg = pos;
        }
        fields.push(value);
        continue;
      }

      // Closed quote at q. Value is the raw slice unless the segment holds
      // a line break (count + normalise to LF) or doubled quotes.
      const segStart = pos + 1;
      let segHasBreak = false;
      let v;
      if (!hasDouble) {
        const jn = text.indexOf('\n', segStart);
        const jr = text.indexOf('\r', segStart);
        if ((jn === -1 || jn >= q) && (jr === -1 || jr >= q)) {
          v = text.slice(segStart, q);
        } else {
          segHasBreak = true;
        }
      }
      if (segHasBreak || hasDouble) {
        let seg = text.slice(segStart, q);
        // Count lines: every LF, every CR not followed by LF.
        let li = 0;
        let p = seg.indexOf('\n');
        while (p !== -1) {
          li += 1;
          p = seg.indexOf('\n', p + 1);
        }
        p = seg.indexOf('\r');
        while (p !== -1) {
          if (seg.charCodeAt(p + 1) !== 10) li += 1;
          p = seg.indexOf('\r', p + 1);
        }
        line += li;
        if (seg.indexOf('\r') !== -1) seg = seg.replace(/\r\n?/g, '\n');
        if (hasDouble) seg = seg.replaceAll('""', '"');
        v = seg;
      }
      value = v;
      pos = q + 1;
      if (pos >= n) {
        ended = 2;
        fields.push(value);
        continue;
      }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        ended = 0;
        fields.push(value);
        continue;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        ended = 1;
        fields.push(value);
        continue;
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        ended = 1;
        fields.push(value);
        continue;
      }
      // Junk after the closing quote: appended as it stands, up to the next
      // comma or line break (stray CRs inside it still error).
      let acc = value;
      let added = 0;
      let seg = pos;
      for (;;) {
        delim.lastIndex = pos;
        const dm = delim.exec(text);
        let j = -1;
        let k = 0;
        if (dm !== null) {
          j = dm.index;
          const dc = text.charCodeAt(dm.index);
          k = dc === 44 ? 0 : dc === 10 ? 1 : 2;
        }
        if (j === -1) {
          added += n - seg;
          value = acc + text.slice(seg);
          pos = n;
          ended = 2;
          break;
        }
        if (k === 0) {
          added += j - seg;
          value = acc + text.slice(seg, j);
          pos = j + 1;
          ended = 0;
          break;
        }
        if (k === 1) {
          added += j - seg;
          value = acc + text.slice(seg, j);
          pos = j + 1;
          line += 1;
          ended = 1;
          break;
        }
        if (text.charCodeAt(j + 1) === 10) {
          added += j - seg;
          value = acc + text.slice(seg, j);
          pos = j + 2;
          line += 1;
          ended = 1;
          break;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        added += j - seg;
        acc += text.slice(seg, j);
        pos = j + 1;
        seg = pos;
      }
      if (added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      fields.push(value);
    } while (ended === 0);

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
