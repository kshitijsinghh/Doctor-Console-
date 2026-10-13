import { FIELD_DEFS, fieldOn, fieldBlockedByParent, isLocked } from './formConfig';
import { cardStyle, headingStyle, Toggle, Pill, INK, MUTED, FAINT, HAIR } from './ui';

export default function FieldsTab({ config, onToggle }) {
  const groups = [];
  FIELD_DEFS.forEach((f) => {
    let g = groups.find((x) => x.title === f.g);
    if (!g) { g = { title: f.g, fields: [] }; groups.push(g); }
    g.fields.push(f);
  });

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
        gap: 16, alignItems: 'start',
      }}>
        {groups.map((g) => {
          const onCount = g.fields.filter((f) => fieldOn(config, f.k)).length;
          return (
            <div key={g.title} style={cardStyle}>
              <div style={{
                padding: '13px 18px', borderBottom: '1px solid #eef4f3',
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10,
              }}>
                <h3 style={headingStyle}>{g.title}</h3>
                <span style={{ fontSize: 12.5, color: MUTED, whiteSpace: 'nowrap' }}>
                  {onCount} of {g.fields.length} on
                </span>
              </div>
              {g.fields.map((f) => {
                const blocked = fieldBlockedByParent(config, f.k);
                const on = fieldOn(config, f.k);
                const locked = isLocked(f.k);
                return (
                  <div key={f.k} style={{
                    padding: '12px 18px', borderTop: '1px solid ' + HAIR,
                    display: 'flex', gap: 14, alignItems: 'center',
                  }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
                        fontWeight: 700, fontSize: 14.5, color: on ? INK : FAINT,
                      }}>
                        {f.label}
                        {locked && <Pill>Always on</Pill>}
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, color: MUTED, textWrap: 'pretty' }}>
                        {blocked ? 'Hidden because Current treatment is off.' : f.desc}
                      </span>
                    </span>
                    <Toggle
                      on={on}
                      disabled={locked || blocked}
                      title={locked ? 'Always on' : blocked ? 'Current treatment is off' : (on ? 'Turn off' : 'Turn on')}
                      onClick={() => onToggle(f.k, !on)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12.5, color: MUTED, marginTop: 14, textWrap: 'pretty' }}>
        Chief complaint and Billing can&rsquo;t be turned off: the first is needed on every
        prescription, the second for receipts and pending balances. Turning off Current
        treatment also hides Treatment group and tooth tagging for it.
      </p>
    </>
  );
}
