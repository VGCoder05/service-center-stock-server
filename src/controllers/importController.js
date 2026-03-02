const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const PartsMaster = require('../models/PartsMaster');
const SerialNumber = require('../models/SerialNumber');
const Supplier = require('../models/Supplier');
const CategoryMovement = require('../models/CategoryMovement'); // Assuming you still have this

// Helper to escape regex special characters
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ===================
// @desc    Bulk import bills from parsed Excel data
// @route   POST /api/v1/import/excel
// @access  Private (Admin, Operator)
// ===================
exports.importExcel = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bills } = req.body;

    if (!bills || !Array.isArray(bills) || bills.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No bills data provided'
      });
    }

    const results = {
      billsCreated: 0,
      billsSkipped: 0,
      partsCreated: 0,
      partsExisting: 0,
      suppliersCreated: 0,
      suppliersExisting: 0,
      serialsCreated: 0,
      serialsSkipped: 0,
      errors: [],
      details: []
    };

    for (const billData of bills) {
      const { billDate, voucherNumber, supplierName, items, totalAmount } = billData;

      // 1. Check if bill already exists
      const existingBill = await Bill.findOne({ voucherNumber }).session(session);
      if (existingBill) {
        results.billsSkipped++;
        results.errors.push(`Bill #${voucherNumber} already exists — skipped`);
        continue;
      }

      // 2. Find or create supplier (with regex escaping)
      let supplier = await Supplier.findOne({
        supplierName: {
          $regex: `^${escapeRegex(supplierName.trim())}$`,
          $options: 'i'
        }
      }).session(session);

      if (!supplier) {
        [supplier] = await Supplier.create(
          [{ supplierName: supplierName.trim(), isActive: true }],
          { session }
        );
        results.suppliersCreated++;
      } else {
        results.suppliersExisting++;
      }

      // Calculate total from items if totalAmount not provided
      const calculatedTotal = items.reduce((sum, item) => {
        return sum + item.serialNumbers.reduce((s, sn) => s + sn.unitPrice, 0);
      }, 0);

      // 3. Create the Bill
      const [bill] = await Bill.create(
        [{
          voucherNumber,
          billDate: new Date(billDate),
          supplierId: supplier._id,
          supplierName: supplier.supplierName,
          totalBillAmount: totalAmount || calculatedTotal,
          notes: 'Imported from Excel',
          receivedBy: req.user?._id,
          receivedByName: req.user?.name
        }],
        { session }
      );

      let serialsCountForBill = 0;

      const categorySummary = {
        IN_STOCK: 0,
        SPU_PENDING: 0,
        SPU_CLEARED: 0,
        AMC: 0,
        OG: 0,
        RETURN: 0,
        RECEIVED_FOR_OTHERS: 0,
        UNCATEGORIZED: 0
      };
      let totalCategorizedValue = 0;

      // 4. Process each item
      for (const item of items) {
        const { partCode, partName, serialNumbers } = item;

        // Find or create part
        let part = await PartsMaster.findOne({
          partCode: partCode.toUpperCase()
        }).session(session);

        if (!part) {
          [part] = await PartsMaster.create(
            [{
              partCode: partCode.toUpperCase(),
              partName: partName,
              unit: 'Pcs',
              isActive: true,
              avgUnitPrice: serialNumbers.length > 0
                ? serialNumbers.reduce((s, sn) => s + sn.unitPrice, 0) / serialNumbers.length
                : 0
            }],
            { session }
          );
          results.partsCreated++;
        } else {
          results.partsExisting++;
        }

        // 5. Create Serial Numbers
        for (const sn of serialNumbers) {

          const existingSerial = await SerialNumber.findOne({
            serialNumber: sn.serialNumber,
            partId: part._id,
            billId: bill._id
          }).session(session);

          if (existingSerial) {
            results.serialsSkipped++;
            results.errors.push(
              `Serial "${sn.serialNumber}" for part ${partCode} in Bill #${voucherNumber} already exists — skipped`
            );
            continue;
          }

          const categoryToSet = sn.category || 'UNCATEGORIZED';

          const [serial] = await SerialNumber.create(
            [{
              serialNumber: sn.serialNumber,
              billId: bill._id,
              voucherNumber: bill.voucherNumber,
              billDate: bill.billDate,

              partId: part._id,
              partCode: part.partCode,
              partName: part.partName,
              unitPrice: sn.unitPrice,

              supplierId: supplier._id,
              supplierName: supplier.supplierName,

              currentCategory: categoryToSet,
              categorizedDate: categoryToSet !== 'UNCATEGORIZED' ? new Date() : null,

              context: {
                remarks: sn.notes || ''
              },
              createdBy: req.user?._id,
              createdByName: req.user?.name
            }],
            { session }
          );

          // Create initial category movement
          if (CategoryMovement) {
            await CategoryMovement.create(
              [{
                // Serial Reference
                serialNumberId: serial._id,
                serialNumber: sn.serialNumber,

                // Bill Reference
                billId: bill._id,
                voucherNumber: bill.voucherNumber,

                // Movement
                movementType: 'INITIAL_ENTRY',
                fromCategory: null,
                toCategory: categoryToSet,

                // Context snapshot at time of import
                contextSnapshot: {
                  unitPrice: sn.unitPrice,
                  partCode: part.partCode,
                  partName: part.partName,
                  remarks: sn.notes || ''
                },

                // Reason
                reason: `Imported from Excel — Bill #${voucherNumber}`,

                // Audit
                performedBy: req.user?._id,
                performedByName: req.user?.name,

                timestamp: new Date()
              }],
              { session }
            );
          }

          if (categorySummary.hasOwnProperty(categoryToSet)) {
            categorySummary[categoryToSet]++;
          }
          if (categoryToSet !== 'UNCATEGORIZED') {
            totalCategorizedValue += sn.unitPrice;
          }

          serialsCountForBill++;
          results.serialsCreated++;
        }
      }

      // 6. Update bill summary using in-memory data WITH session
      //    Replaces the broken: await bill.updateCategorySummary()
      await Bill.updateOne(
        { _id: bill._id },
        {
          $set: {
            totalSerialNumbers: serialsCountForBill,
            categorySummary,
            totalCategorizedValue,
            isFullyCategorized:
              categorySummary.UNCATEGORIZED === 0 && serialsCountForBill > 0
          }
        },
        { session }
      );

      results.billsCreated++;
      results.details.push({
        voucherNumber,
        supplierName: supplier.supplierName,
        itemsCount: items.length,
        serialsCount: serialsCountForBill
      });
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: `Import completed: ${results.billsCreated} bills created, ${results.billsSkipped} skipped`,
      data: results
    });

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// ===================
// @desc    Validate parsed data before import (dry run)
// @route   POST /api/v1/import/validate
// @access  Private (Admin, Operator)
// ===================
exports.validateImport = async (req, res, next) => {
  try {
    const { bills } = req.body;
    // console.log(bills)

    if (!bills || !Array.isArray(bills) || bills.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No bills data provided'
      });
    }

    const validation = {
      totalBills: bills.length,
      totalItems: 0,
      totalSerials: 0,
      totalValue: 0,
      duplicateBills: [],
      existingParts: [],
      newParts: [],
      existingSuppliers: [],
      newSuppliers: [],
      warnings: []
    };

    const supplierNames = new Set();
    const partCodes = new Set();

    for (const bill of bills) {
      const existing = await Bill.findOne({ voucherNumber: bill.voucherNumber });
      if (existing) {
        validation.duplicateBills.push(bill.voucherNumber);
      }

      supplierNames.add(bill.supplierName.trim().toUpperCase());

      for (const item of bill.items) {
        validation.totalItems++;
        partCodes.add(item.partCode.toUpperCase());

        for (const sn of item.serialNumbers) {
          validation.totalSerials++;
          validation.totalValue += sn.unitPrice;

          if (!sn.category || sn.category === 'UNCATEGORIZED') {
            validation.warnings.push(
              `Bill #${bill.voucherNumber} → ${item.partCode} → Serial "${sn.serialNumber}" has no category`
            );
          }
        }
      }
    }

    for (const name of supplierNames) {
      const exists = await Supplier.findOne({
        supplierName: { $regex: `^${name}$`, $options: 'i' }
      });
      if (exists) {
        validation.existingSuppliers.push(name);
      } else {
        validation.newSuppliers.push(name);
      }
    }

    for (const code of partCodes) {
      const exists = await PartsMaster.findOne({ partCode: code });
      if (exists) {
        validation.existingParts.push(code);
      } else {
        validation.newParts.push(code);
      }
    }

    res.status(200).json({
      success: true,
      data: validation
    });

  } catch (error) {
    next(error);
  }
};