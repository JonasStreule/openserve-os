export interface CashReportData {
  date: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  closingAmount: number;
  expectedAmount: number;
  difference: number;
  breakdown: Array<{ type: string; count: number; total: number }>;
  totalRevenue: number;
  totalOrders: number;
  totalTips: number;
}

function formatCHF(amount: number): string {
  return `CHF ${amount.toFixed(2)}`;
}

function paymentLabel(type: string): string {
  switch (type) {
    case 'cash': return 'Bar';
    case 'card': return 'Karte';
    case 'twint': return 'Twint';
    default: return type;
  }
}

export function generateCashReport(data: CashReportData): void {
  const diffColor = data.difference < 0 ? '#c0392b' : data.difference > 0 ? '#27ae60' : '#333';
  const diffSign = data.difference > 0 ? '+' : '';

  const breakdownRows = data.breakdown
    .map(
      (item) => `
      <tr>
        <td>${paymentLabel(item.type)}</td>
        <td style="text-align:center">${item.count}</td>
        <td style="text-align:right;font-family:'Courier New',monospace">${formatCHF(item.total)}</td>
      </tr>`
    )
    .join('');

  const now = new Date().toLocaleString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Tagesabschluss - ${data.date}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 14px;
      color: #333;
      padding: 40px;
      max-width: 700px;
      margin: 0 auto;
    }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin: 24px 0 12px 0; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header .date { font-size: 15px; color: #666; }
    .overview-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .overview-table td { padding: 6px 0; }
    .overview-table td:first-child { color: #666; }
    .overview-table td:last-child { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
    .breakdown-table { width: 100%; border-collapse: collapse; }
    .breakdown-table th { text-align: left; padding: 6px 0; border-bottom: 1px solid #ccc; font-weight: 600; font-size: 13px; color: #666; }
    .breakdown-table th:nth-child(2) { text-align: center; }
    .breakdown-table th:last-child { text-align: right; }
    .breakdown-table td { padding: 6px 0; border-bottom: 1px solid #eee; }
    .summary-table { width: 100%; border-collapse: collapse; }
    .summary-table td { padding: 6px 0; }
    .summary-table td:first-child { color: #666; }
    .summary-table td:last-child { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; }
    .footer { margin-top: 48px; font-size: 12px; color: #999; }
    .signature { margin-top: 40px; font-size: 13px; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>OpenServe OS &mdash; Tagesabschluss</h1>
    <div class="date">${data.date}</div>
  </div>

  <h2>Kassen&uuml;bersicht</h2>
  <table class="overview-table">
    <tr>
      <td>Kasse ge&ouml;ffnet</td>
      <td>${data.openedAt}</td>
    </tr>
    <tr>
      <td>Kasse geschlossen</td>
      <td>${data.closedAt}</td>
    </tr>
    <tr>
      <td>Anfangsbestand</td>
      <td>${formatCHF(data.openingAmount)}</td>
    </tr>
    <tr>
      <td>Schlussbestand (gez&auml;hlt)</td>
      <td>${formatCHF(data.closingAmount)}</td>
    </tr>
    <tr>
      <td>Soll-Bestand (erwartet)</td>
      <td>${formatCHF(data.expectedAmount)}</td>
    </tr>
    <tr>
      <td>Differenz</td>
      <td style="color:${diffColor};font-weight:700">${diffSign}${formatCHF(data.difference)}</td>
    </tr>
  </table>

  <h2>Umsatz nach Zahlungsart</h2>
  <table class="breakdown-table">
    <thead>
      <tr>
        <th>Zahlungsart</th>
        <th style="text-align:center">Anzahl</th>
        <th style="text-align:right">Betrag</th>
      </tr>
    </thead>
    <tbody>
      ${breakdownRows || '<tr><td colspan="3" style="text-align:center;color:#999;padding:12px">Keine Zahlungen</td></tr>'}
    </tbody>
  </table>

  <h2>Zusammenfassung</h2>
  <table class="summary-table">
    <tr>
      <td>Gesamtumsatz</td>
      <td>${formatCHF(data.totalRevenue)}</td>
    </tr>
    <tr>
      <td>Anzahl Bestellungen</td>
      <td>${data.totalOrders}</td>
    </tr>
    <tr>
      <td>Trinkgeld</td>
      <td>${data.totalTips > 0 ? formatCHF(data.totalTips) : '&mdash;'}</td>
    </tr>
  </table>

  <div class="signature">
    Unterschrift: ___________________________
  </div>

  <div class="footer">
    Erstellt am ${now}
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
