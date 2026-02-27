const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Ensure exports directory exists
const exportsDir = path.join(__dirname, '..', 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

// Category colors for styling
const CATEGORY_COLORS = {
  IN_STOCK: { bg: 'DBEAFE', text: '1E40AF' },
  SPU_PENDING: { bg: 'FEE2E2', text: '991B1B' },
  SPU_CLEARED: { bg: 'DCFCE7', text: '166534' },
  AMC: { bg: 'F3E8FF', text: '6B21A8' },
  OG: { bg: 'FFEDD5', text: '9A3412' },
  RETURN: { bg: 'FEF9C3', text: '854D0E' },
  RECEIVED_FOR_OTHERS: { bg: 'F3F4F6', text: '374151' },
  UNCATEGORIZED: { bg: 'FFFFFF', text: '6B7280' }
};

// Common styles
const headerStyle = {
  font: { bold: true, size: 12, color: { argb: 'FFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F2937' } },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }
};

const cellStyle = {
  border: {
    top: { style: 'thin', color: { argb: 'E5E7EB' } },
    left: { style: 'thin', color: { argb: 'E5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
    right: { style: 'thin', color: { argb: 'E5E7EB' } }
  }
};

const currencyFormat = '₹#,##0.00';

class ExcelService {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'Service Center Stock Manager';
    this.workbook.created = new Date();
  }

  // Generate unique filename
  generateFilename(reportType, startDate, endDate) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dateRange = startDate && endDate 
      ? `_${startDate}_to_${endDate}` 
      : '_all-time';
    return `${reportType}${dateRange}_${timestamp}.xlsx`;
  }

  // Add title row to worksheet
  addTitle(worksheet, title, dateRange) {
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:H2');
    const dateCell = worksheet.getCell('A2');
    dateCell.value = dateRange || 'All Time';
    dateCell.font = { size: 11, italic: true };
    dateCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]);
  }

  // Style header row
  styleHeaderRow(row) {
    row.eachCell((cell) => {
      cell.font = headerStyle.font;
      cell.fill = headerStyle.fill;
      cell.alignment = headerStyle.alignment;
      cell.border = headerStyle.border;
    });
    row.height = 25;
  }

  // Style data row with category color
  styleDataRow(row, category) {
    const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.UNCATEGORIZED;
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colors.bg }
      };
      cell.font = { color: { argb: colors.text } };
      cell.border = cellStyle.border;
    });
  }

  // Generate Stock Valuation Report
  async generateStockValuation(data, options = {}) {
    const { startDate, endDate } = options;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Service Center Stock Manager';

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.addTitle(
      summarySheet, 
      'Stock Valuation Report',
      startDate && endDate ? `${startDate} to ${endDate}` : 'All Time'
    );

    // Summary headers
    summarySheet.addRow(['Category', 'Quantity', 'Total Value', '% of Total']);
    this.styleHeaderRow(summarySheet.getRow(4));

    // Summary data
    let totalQty = 0;
    let totalValue = 0;
    const categories = Object.entries(data.categories);
    
    categories.forEach(([cat, info]) => {
      totalQty += info.count;
      totalValue += info.totalValue;
    });

    categories.forEach(([cat, info]) => {
      const row = summarySheet.addRow([
        cat.replace(/_/g, ' '),
        info.count,
        info.totalValue,
        totalValue > 0 ? ((info.totalValue / totalValue) * 100).toFixed(1) + '%' : '0%'
      ]);
      this.styleDataRow(row, cat);
    });

    // Total row
    const totalRow = summarySheet.addRow(['TOTAL', totalQty, totalValue, '100%']);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E5E7EB' } };
      cell.border = cellStyle.border;
    });

    // Format columns
    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 15;
    summarySheet.getColumn(3).width = 20;
    summarySheet.getColumn(3).numFmt = currencyFormat;
    summarySheet.getColumn(4).width = 15;

    // Detail sheets for each category with data
    for (const [category, items] of Object.entries(data.details)) {
      if (items.length === 0) continue;

      const sheet = workbook.addWorksheet(category.replace(/_/g, ' ').substring(0, 31));
      this.addTitle(sheet, category.replace(/_/g, ' '), options.dateRange);

      // Headers based on category
      const headers = ['Serial Number', 'Part Name', 'Part Code', 'Voucher No.', 'Bill Date', 'Supplier', 'Unit Price'];
      
      if (['SPU_PENDING', 'SPU_CLEARED'].includes(category)) {
        headers.push('SPU ID', 'Customer', 'Chargeable');
      } else if (category === 'AMC') {
        headers.push('Customer', 'AMC No.');
      } else if (category === 'OG') {
        headers.push('Customer', 'Cash Amount', 'Payment Status');
      } else if (category === 'RETURN') {
        headers.push('Return Reason');
      } else if (category === 'RECEIVED_FOR_OTHERS') {
        headers.push('Received For', 'Transfer Status');
      } else if (category === 'IN_STOCK') {
        headers.push('Location');
      }

      sheet.addRow(headers);
      this.styleHeaderRow(sheet.getRow(4));

      // Data rows
      items.forEach(item => {
        const rowData = [
          item.serialNumber,
          item.partName,
          item.partCode || '-',
          item.voucherNumber,
          item.billDate ? new Date(item.billDate).toLocaleDateString('en-IN') : '-',
          item.supplierName || '-',
          item.unitPrice
        ];

        if (['SPU_PENDING', 'SPU_CLEARED'].includes(category)) {
          rowData.push(
            item.context?.spuId || '-',
            item.context?.customerName || '-',
            item.context?.isChargeable ? 'Yes' : 'No'
          );
        } else if (category === 'AMC') {
          rowData.push(
            item.context?.customerName || '-',
            item.context?.amcNumber || '-'
          );
        } else if (category === 'OG') {
          rowData.push(
            item.context?.customerName || '-',
            item.context?.cashAmount || 0,
            item.context?.paymentStatus || '-'
          );
        } else if (category === 'RETURN') {
          rowData.push(item.context?.returnReason || '-');
        } else if (category === 'RECEIVED_FOR_OTHERS') {
          rowData.push(
            item.context?.receivedFor || '-',
            item.context?.transferStatus || '-'
          );
        } else if (category === 'IN_STOCK') {
          rowData.push(item.context?.location || '-');
        }

        const row = sheet.addRow(rowData);
        this.styleDataRow(row, category);
      });

      // Subtotal
      const subtotalRow = sheet.addRow([
        'SUBTOTAL', '', '', '', '', '', 
        items.reduce((sum, i) => sum + (i.unitPrice || 0), 0)
      ]);
      subtotalRow.font = { bold: true };

      // Auto-fit columns
      sheet.columns.forEach((col, i) => {
        col.width = i === 0 ? 20 : (i === 1 ? 25 : 15);
      });
      sheet.getColumn(7).numFmt = currencyFormat;
    }

    // Save to file
    const filename = this.generateFilename('StockValuation', startDate, endDate);
    const filepath = path.join(exportsDir, filename);
    await workbook.xlsx.writeFile(filepath);

    return { filename, filepath };
  }

  // Generate Bill-wise Report (IN_STOCK grouped by bill)
  async generateBillWiseReport(data, options = {}) {
    const { startDate, endDate } = options;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Service Center Stock Manager';

    const sheet = workbook.addWorksheet('IN STOCK by Bill');
    this.addTitle(
      sheet,
      'IN STOCK Report (Grouped by Bill)',
      startDate && endDate ? `${startDate} to ${endDate}` : 'All Time'
    );

    // Headers
    sheet.addRow(['Voucher No.', 'Company Bill', 'Supplier', 'Bill Date', 'Serial No.', 'Part Name', 'Unit Price', 'Location']);
    this.styleHeaderRow(sheet.getRow(4));

    let grandTotal = 0;

    // Group data by bill
    data.forEach(bill => {
      let billTotal = 0;

      bill.serials.forEach((serial, idx) => {
        const row = sheet.addRow([
          idx === 0 ? bill.voucherNumber : '',
          idx === 0 ? bill.companyBillNumber || '-' : '',
          idx === 0 ? bill.supplierName : '',
          idx === 0 ? new Date(bill.billDate).toLocaleDateString('en-IN') : '',
          serial.serialNumber,
          serial.partName,
          serial.unitPrice,
          serial.context?.location || '-'
        ]);
        this.styleDataRow(row, 'IN_STOCK');
        billTotal += serial.unitPrice || 0;
      });

      // Bill subtotal
      const subtotalRow = sheet.addRow(['', '', '', '', '', 'Bill Subtotal:', billTotal, '']);
      subtotalRow.font = { bold: true };
      subtotalRow.getCell(7).numFmt = currencyFormat;
      
      grandTotal += billTotal;
      sheet.addRow([]); // Empty row between bills
    });

    // Grand total
    const grandTotalRow = sheet.addRow(['', '', '', '', '', 'GRAND TOTAL:', grandTotal, '']);
    grandTotalRow.font = { bold: true, size: 12 };
    grandTotalRow.getCell(7).numFmt = currencyFormat;
    grandTotalRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };

    // Column widths
    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(6).width = 25;
    sheet.getColumn(7).width = 15;
    sheet.getColumn(7).numFmt = currencyFormat;
    sheet.getColumn(8).width = 15;

    // Save
    const filename = this.generateFilename('InStock_BillWise', startDate, endDate);
    const filepath = path.join(exportsDir, filename);
    await workbook.xlsx.writeFile(filepath);

    return { filename, filepath };
  }

  // Generate SPU Report (grouped by SPU ID)
  async generateSPUReport(data, options = {}) {
    const { startDate, endDate, status } = options;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Service Center Stock Manager';

    const sheetName = status === 'SPU_CLEARED' ? 'SPU Cleared' : 'SPU Pending';
    const sheet = workbook.addWorksheet(sheetName);
    this.addTitle(
      sheet,
      `${sheetName} Report (Grouped by SPU ID)`,
      startDate && endDate ? `${startDate} to ${endDate}` : 'All Time'
    );

    // Headers
    sheet.addRow(['SPU ID', 'Ticket ID', 'Customer', 'SPU Date', 'Serial No.', 'Part Name', 'Unit Price', 'Chargeable', 'Charge Amt', 'Payment']);
    this.styleHeaderRow(sheet.getRow(4));

    let grandTotal = 0;
    let chargeableTotal = 0;

    // Group data by SPU ID
    data.forEach(spu => {
      let spuTotal = 0;
      let spuChargeable = 0;

      spu.serials.forEach((serial, idx) => {
        const row = sheet.addRow([
          idx === 0 ? spu.spuId : '',
          idx === 0 ? spu.ticketId || '-' : '',
          idx === 0 ? spu.customerName || '-' : '',
          idx === 0 ? (spu.spuDate ? new Date(spu.spuDate).toLocaleDateString('en-IN') : '-') : '',
          serial.serialNumber,
          serial.partName,
          serial.unitPrice,
          serial.context?.isChargeable ? 'Yes' : 'No',
          serial.context?.isChargeable ? (serial.context?.chargeAmount || 0) : '-',
          serial.context?.isChargeable ? (serial.context?.paymentStatus || '-') : '-'
        ]);
        this.styleDataRow(row, status || 'SPU_PENDING');
        spuTotal += serial.unitPrice || 0;
        if (serial.context?.isChargeable) {
          spuChargeable += serial.context?.chargeAmount || 0;
        }
      });

      // SPU subtotal
      const subtotalRow = sheet.addRow(['', '', '', '', '', 'SPU Subtotal:', spuTotal, '', spuChargeable, '']);
      subtotalRow.font = { bold: true };
      
      grandTotal += spuTotal;
      chargeableTotal += spuChargeable;
      sheet.addRow([]);
    });

    // Grand total
    const grandTotalRow = sheet.addRow(['', '', '', '', '', 'GRAND TOTAL:', grandTotal, '', chargeableTotal, '']);
    grandTotalRow.font = { bold: true, size: 12 };
    grandTotalRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };

    // Column widths
    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 12;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 22;
    sheet.getColumn(7).width = 12;
    sheet.getColumn(7).numFmt = currencyFormat;
    sheet.getColumn(8).width = 12;
    sheet.getColumn(9).width = 12;
    sheet.getColumn(9).numFmt = currencyFormat;
    sheet.getColumn(10).width = 12;

    // Save
    const filename = this.generateFilename(status || 'SPU', startDate, endDate);
    const filepath = path.join(exportsDir, filename);
    await workbook.xlsx.writeFile(filepath);

    return { filename, filepath };
  }

  // Clean up old export files (older than 1 hour)
  static cleanupOldFiles() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    if (fs.existsSync(exportsDir)) {
      fs.readdirSync(exportsDir).forEach(file => {
        const filepath = path.join(exportsDir, file);
        const stats = fs.statSync(filepath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filepath);
        }
      });
    }
  }
}

module.exports = ExcelService;