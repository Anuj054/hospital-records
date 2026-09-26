import { useMemo } from "react";
import { flattenBillCategories } from "../lib/billCategories";
import { rupeesInWords } from "../lib/rupeesInWords";

const ROWS = flattenBillCategories();
const ROOM = "room";

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(+d) ? "" : d.toLocaleDateString("en-IN");
}

// The pad splits money into a rupees column and a paise column, so the two
// halves are rendered separately rather than as one "1834.50" string.
function splitAmount(amount) {
  const paise = Math.round(amount * 100) % 100;
  return { rupees: Math.floor(amount).toLocaleString("en-IN"), paise: String(paise).padStart(2, "0") };
}

// Collapses a bill's items onto the pad's fixed lines. Items whose name is the
// category's own label are the pad line itself; anything else (catalog
// medicines, custom charges) prints as a named sub-line underneath it, which
// is also how a merged bill's duplicate lines stay legible.
function groupByCategory(items, labelFor) {
  const groups = new Map();
  for (const item of items) {
    const slug = item.category || "misc";
    if (!groups.has(slug)) groups.set(slug, { total: 0, remarks: [], named: [], quantity: 0, unitPrice: 0 });
    const group = groups.get(slug);
    group.total += item.amount;
    if (item.remarks) group.remarks.push(item.remarks);
    if (item.name === labelFor(slug)) {
      group.quantity += item.quantity || 0;
      group.unitPrice = item.unitPrice ?? group.unitPrice;
    } else {
      group.named.push(item);
    }
  }
  return groups;
}

// The printable bill: a replica of the hospital's pre-printed BILL/CASH pad.
// Pure and prop-driven so it can be rendered outside the app (and so the page
// that fetches the data isn't also responsible for the layout).
export default function BillPad({ bill, patient, settings, printRef }) {
  const groups = useMemo(() => {
    const labelFor = (slug) => ROWS.find((r) => r.slug === slug)?.label ?? slug;
    return groupByCategory(bill.items, labelFor);
  }, [bill]);

  const total = splitAmount(bill.totalAmount);

  return (
  <div className="bill-pad" ref={printRef}>
    <div className="pad-kind">BILL/CASH</div>

    <div className="pad-head">
      <h1>{settings.hospitalName}</h1>
      {settings.regNo && <p className="pad-reg">Reg. No. {settings.regNo}</p>}
      {settings.address && <p>{settings.address}</p>}
      {settings.phone && <p>Phone: {settings.phone}</p>}
    </div>

    <div className="pad-fields">
      <div className="pad-field pad-field-half">
        <span className="pad-label">No.</span>
        <span className="pad-value">{bill.billNumber || "—"}</span>
      </div>
      <div className="pad-field pad-field-half">
        <span className="pad-label">Date</span>
        <span className="pad-value">{formatDate(bill.finalizedAt || bill.date)}</span>
      </div>
      <div className="pad-field">
        <span className="pad-label">Name</span>
        <span className="pad-value">
          {patient.name} ({patient.patientId})
        </span>
      </div>
      <div className="pad-field">
        <span className="pad-label">Address</span>
        <span className="pad-value">{patient.address || ""}</span>
      </div>
      <div className="pad-field pad-field-half">
        <span className="pad-label">D. O. A.</span>
        <span className="pad-value">{formatDate(bill.admission?.dateOfAdmission)}</span>
      </div>
      <div className="pad-field pad-field-half">
        <span className="pad-label">D. O. D.</span>
        <span className="pad-value">{formatDate(bill.admission?.dateOfDischarge)}</span>
      </div>
      <div className="pad-field pad-field-half">
        <span className="pad-label">Time of Admission</span>
        <span className="pad-value">{bill.admission?.timeOfAdmission || ""}</span>
      </div>
      <div className="pad-field pad-field-half">
        <span className="pad-label">T. O. D.</span>
        <span className="pad-value">{bill.admission?.timeOfDischarge || ""}</span>
      </div>
    </div>

    <div className="table-x-scroll">
      <table className="pad-table">
        <thead>
          <tr>
            <th rowSpan="2" className="pad-col-sno">
              S.No.
            </th>
            <th rowSpan="2">PARTICULARS</th>
            <th colSpan="2" className="pad-col-amount">
              AMOUNT
            </th>
            <th rowSpan="2" className="pad-col-remarks">
              REMARKS
            </th>
          </tr>
          <tr>
            <th className="pad-col-rs">Rs.</th>
            <th className="pad-col-p">P.</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const group = groups.get(row.slug);
            // Header lines (Investigation) never carry an amount of their
            // own — their children below do.
            const money = !row.isHeader && group?.total ? splitAmount(group.total) : null;
            // Only a stay billed as rate x days can fill in the pad's
            // "Rs. ____ Per Day" line. A lump sum leaves it blank, exactly as
            // it sits pre-printed on the paper.
            const rate = row.slug === ROOM && group?.quantity > 1 ? group.unitPrice : null;
            return (
              <tr key={row.slug} className={row.isHeader ? "pad-header-row" : undefined}>
                <td className="pad-col-sno">{row.no || ""}</td>
                <td className={row.parent ? "pad-child-label" : undefined}>
                  {row.label}
                  {row.lines?.map((line) => (
                    <div className="pad-sub-line" key={line}>
                      {line}
                    </div>
                  ))}
                  {row.perDay && (
                    <div className="pad-sub-line">
                      Rs. {rate ? rate.toLocaleString("en-IN") : "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0"} Per Day
                    </div>
                  )}
                  {group?.named.map((item, i) => (
                    <div className="pad-named-item" key={i}>
                      {item.name}
                      {item.quantity > 1 ? ` x${item.quantity}` : ""}
                    </div>
                  ))}
                </td>
                <td className="pad-col-rs">{money?.rupees ?? ""}</td>
                <td className="pad-col-p">{money?.paise ?? ""}</td>
                <td className="pad-col-remarks">
                  {/* Only a rate x days stay has a day count worth printing.
                      A lump sum is stored as quantity 1 and would otherwise
                      claim a "1 day" stay nobody entered. */}
                  {rate
                    ? [`${group.quantity} days`, ...(group?.remarks ?? [])].join(", ")
                    : (group?.remarks ?? []).join(", ")}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="2" className="pad-total-label">
              Total
            </td>
            <td className="pad-col-rs">{total.rupees}</td>
            <td className="pad-col-p">{total.paise}</td>
            <td className="pad-col-remarks" />
          </tr>
        </tfoot>
      </table>
    </div>

    <div className="pad-foot">
      <div className="pad-field">
        <span className="pad-label">Total Rupees</span>
        <span className="pad-value">{rupeesInWords(bill.totalAmount)}</span>
      </div>
      <div className="pad-field">
        <span className="pad-label">Received with thanks from</span>
        <span className="pad-value">{bill.receivedFrom || ""}</span>
      </div>
      <div className="pad-field pad-field-half">
        <span className="pad-label">Dates</span>
        <span className="pad-value">
          {bill.payments.map((p) => formatDate(p.paidAt)).join(", ")}
        </span>
      </div>
      {bill.notes && (
        <div className="pad-field">
          <span className="pad-label">Remarks</span>
          <span className="pad-value">{bill.notes}</span>
        </div>
      )}
    </div>

    <div className="pad-signature">
      <div className="pad-signature-line" />
      <p>Signature of cashier</p>
    </div>
  </div>
  );
}
