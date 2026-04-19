import "server-only"

/**
 * Invoice PDF component + server-side renderer.
 *
 * IMPORTANT — `import "server-only"` above is non-negotiable. @react-pdf/
 * renderer's Node entry is heavyweight; a Client Component import would
 * pull pdf-lib into the browser bundle. The directive makes that a build
 * error instead of a production surprise.
 *
 * Indonesian-specific details enforced here (see docs/DECISIONS.md):
 *   - PPN line reads exactly "PPN 1.1% (DPP Nilai Lain)" — the parenthetical
 *     is what tells an Indonesian accountant this is the freight-specific
 *     effective rate under PMK-71/PMK.03/2022, not a typo for 11%.
 *   - All amounts via lib/currency's formatIDR (Rp 1.900.000 shape).
 *   - All dates/datetimes via lib/time in WIB.
 *   - "Internal reference — not a tax invoice (Faktur Pajak) number" is
 *     a smaller, grey disclaimer so no one mistakes our internal ID for a
 *     DJP-regulated Faktur Pajak.
 */

import path from "node:path"

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer"

import { formatIDR } from "@/lib/currency"
import { formatWIBDate, formatWIBDateTime } from "@/lib/time"
import type { InvoiceType } from "@/prisma/generated/enums"

// Brand token — red accent rule mirrors globals.css. Any other "brand"
// treatment on this letterhead comes from the logo image itself; we do
// not reconstruct the mark in code (see commit history 2026-04-19).
const BRAND_RED = "#cc2229"

// Absolute filesystem path to the logo asset. @react-pdf/renderer runs in
// Node during rendering, so `Image src=` accepts a local path. Native
// JPEG dimensions after cropping: 935 × 345 → aspect ~2.71:1.
const LOGO_SRC = path.join(process.cwd(), "public", "logo-dgk.jpeg")

export interface InvoicePDFData {
  invoiceNumber: string
  type: InvoiceType
  issueDate: Date
  dueDate: Date
  fromOrg: {
    name: string
    address: string
    taxId: string | null
    bankName: string | null
    bankAccount: string | null
  }
  toOrg: {
    name: string
    address: string
    taxId: string | null
  }
  subtotalIDR: number
  taxIDR: number
  totalIDR: number
  paymentTermsDays: number
  orderNumber: string
  doNumber: string
  route: string
  truckTypeLabel: string
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingTop: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  // Brand-red rule running across the very top of every page — the print
  // equivalent of the 3px rule on the web login.
  brandRule: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: BRAND_RED,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  // ~2.71:1 aspect ratio preserved: 160 wide × 59 tall.
  logoImage: { width: 160, height: 59 },
  fromBlock: { flexDirection: "column", maxWidth: "62%", marginTop: 10 },
  fromName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  invoiceBlock: { flexDirection: "column", alignItems: "flex-end" },
  invoiceTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    marginBottom: 6,
    color: "#1a1a1a",
  },
  invoiceMeta: { fontSize: 10, color: "#333", lineHeight: 1.4 },
  divider: { borderBottom: "1pt solid #ddd", marginVertical: 12 },
  billTo: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    color: "#666",
    marginBottom: 4,
    letterSpacing: 1,
  },
  billToName: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 2 },
  small: { fontSize: 9, color: "#444", lineHeight: 1.4 },
  table: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #333",
    paddingBottom: 4,
    marginBottom: 6,
  },
  th: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#333" },
  tableRow: { flexDirection: "row", paddingVertical: 4 },
  td: { fontSize: 10 },
  totals: { alignSelf: "flex-end", width: "45%", marginTop: 8 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTop: "1pt solid #333",
  },
  totalLabel: { fontSize: 10, color: "#333" },
  totalValue: { fontSize: 10 },
  totalLabelBold: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalValueBold: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  payment: { marginTop: 28 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    borderTop: "1pt solid #eee",
    paddingTop: 8,
  },
  disclaimer: {
    fontSize: 8,
    color: "#888",
    lineHeight: 1.4,
    fontStyle: "italic",
  },
})

function InvoiceDocument({ data }: { data: InvoicePDFData }) {
  // Only stamp DGK letterhead when DGK is the issuing org (customer
  // invoices). Vendor → DGK invoices are issued BY the vendor, so putting
  // DGK's logo on them would misrepresent who the invoice is from.
  const isDgkIssued = data.type === "DGK_TO_CUSTOMER"
  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author={data.fromOrg.name}
      subject={data.type === "VENDOR_TO_DGK" ? "Vendor invoice" : "Customer invoice"}
    >
      <Page size="A4" style={styles.page}>
        {/* Brand-red rule across the top — letterhead cue before any ink. */}
        <View style={styles.brandRule} fixed />

        {/* Header — DGK letterhead renders the real logo image (which
         * already contains the icon + wordmark + subtitle). Vendor-issued
         * invoices fall back to a plain text from-block so we never stamp
         * DGK's mark on a document that isn't from DGK. */}
        <View style={styles.header}>
          <View>
            {isDgkIssued ? (
              <>
                <Image src={LOGO_SRC} style={styles.logoImage} />
                <View style={styles.fromBlock}>
                  <Text style={styles.small}>{data.fromOrg.address}</Text>
                  {data.fromOrg.taxId && (
                    <Text style={styles.small}>
                      NPWP: {data.fromOrg.taxId}
                    </Text>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.fromBlock}>
                <Text style={styles.fromName}>{data.fromOrg.name}</Text>
                <Text style={styles.small}>{data.fromOrg.address}</Text>
                {data.fromOrg.taxId && (
                  <Text style={styles.small}>NPWP: {data.fromOrg.taxId}</Text>
                )}
              </View>
            )}
          </View>
          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>No: {data.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>
              Issued: {formatWIBDate(data.issueDate)}
            </Text>
            <Text style={styles.invoiceMeta}>
              Due: {formatWIBDate(data.dueDate)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill to */}
        <View style={styles.billTo}>
          <Text style={styles.sectionLabel}>Bill to</Text>
          <Text style={styles.billToName}>{data.toOrg.name}</Text>
          <Text style={styles.small}>{data.toOrg.address}</Text>
          {data.toOrg.taxId && (
            <Text style={styles.small}>NPWP: {data.toOrg.taxId}</Text>
          )}
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: "55%" }]}>Description</Text>
            <Text style={[styles.th, { width: "10%", textAlign: "right" }]}>Qty</Text>
            <Text style={[styles.th, { width: "17.5%", textAlign: "right" }]}>
              Unit price
            </Text>
            <Text style={[styles.th, { width: "17.5%", textAlign: "right" }]}>
              Amount
            </Text>
          </View>
          <View style={styles.tableRow}>
            <View style={{ width: "55%" }}>
              <Text style={styles.td}>Freight service</Text>
              <Text style={styles.small}>
                {data.route} · {data.truckTypeLabel}
              </Text>
              <Text style={styles.small}>
                Ref: {data.orderNumber} / {data.doNumber}
              </Text>
            </View>
            <Text style={[styles.td, { width: "10%", textAlign: "right" }]}>1</Text>
            <Text style={[styles.td, { width: "17.5%", textAlign: "right" }]}>
              {formatIDR(data.subtotalIDR)}
            </Text>
            <Text style={[styles.td, { width: "17.5%", textAlign: "right" }]}>
              {formatIDR(data.subtotalIDR)}
            </Text>
          </View>
        </View>

        {/* Totals — right-aligned block */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatIDR(data.subtotalIDR)}</Text>
          </View>
          <View style={styles.totalRow}>
            {/*
              The parenthetical "(DPP Nilai Lain)" is load-bearing — it tells an
              Indonesian accountant this is the freight-specific effective rate
              under PMK-71/PMK.03/2022, not a typo for the headline 11% PPN.
              DO NOT shorten this label.
            */}
            <Text style={styles.totalLabel}>PPN 1.1% (DPP Nilai Lain)</Text>
            <Text style={styles.totalValue}>{formatIDR(data.taxIDR)}</Text>
          </View>
          <View style={styles.totalRowFinal}>
            <Text style={styles.totalLabelBold}>Total</Text>
            <Text style={styles.totalValueBold}>{formatIDR(data.totalIDR)}</Text>
          </View>
        </View>

        {/* Payment details */}
        <View style={styles.payment}>
          <Text style={styles.sectionLabel}>Payment</Text>
          {data.fromOrg.bankName && data.fromOrg.bankAccount && (
            <Text style={styles.small}>
              Bank: {data.fromOrg.bankName} — A/C: {data.fromOrg.bankAccount}
            </Text>
          )}
          <Text style={styles.small}>
            Payment terms: net {data.paymentTermsDays} days from issue date
          </Text>
        </View>

        {/* Footer — smaller, grey, visually distinct from invoice body */}
        <View style={styles.footer} fixed>
          <Text style={styles.disclaimer}>
            Internal reference — not a tax invoice (Faktur Pajak) number.
          </Text>
          <Text style={styles.disclaimer}>
            Generated {formatWIBDateTime(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />)
}
