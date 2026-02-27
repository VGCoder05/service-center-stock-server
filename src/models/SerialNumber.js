const mongoose = require('mongoose');

const SerialNumberSchema = new mongoose.Schema({
  // Serial Number (Unique Identifier)
  serialNumber: {
    type: String,
    required: [true, 'Serial number is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [100, 'Serial number cannot exceed 100 characters']
  },

  // Bill Relationship (Parent)
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: [true, 'Bill is required'],
    index: true
  },
  voucherNumber: {
    type: String,
    trim: true
  },
  companyBillNumber: {
    type: String,
    trim: true
  },
  billDate: {
    type: Date,
    required: true,
    index: true
  },

  // Part Information
  partId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PartsMaster'
  },
  partCode: {
    type: String,
    trim: true
  },
  partName: {
    type: String,
    required: [true, 'Part name is required'],
    trim: true
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },

  // Supplier Information (denormalized)
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierName: {
    type: String,
    trim: true
  },

  // Category (Current State)
  currentCategory: {
    type: String,
    enum: [
      'UNCATEGORIZED',
      'IN_STOCK',
      'SPU_PENDING',
      'SPU_CLEARED',
      'AMC',
      'OG',
      'RETURN',
      'RECEIVED_FOR_OTHERS'
    ],
    default: 'UNCATEGORIZED',
    index: true
  },
  categorizedDate: {
    type: Date
  },
  lastCategoryChange: {
    type: Date
  },

  // Category Context (Flexible JSON)
  context: {
    // === For SPU_PENDING / SPU_CLEARED ===
    spuId: String,
    ticketId: String,
    spuDate: Date,
    spuStatus: String,

    // === Customer Information (SPU/AMC/OG) ===
    customerName: String,
    customerContact: String,
    productModel: String,
    productSerialNumber: String,

    // === Payment (Conditional) ===
    isChargeable: {
      type: Boolean,
      default: false
    },
    chargeAmount: Number,
    chargeReason: String,
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PENDING', 'PARTIAL', 'WAIVED', null]
    },
    paymentDate: Date,
    paymentMode: {
      type: String,
      enum: ['CASH', 'CHEQUE', 'ONLINE', 'UPI', null]
    },

    // === For AMC ===
    amcNumber: String,
    amcServiceDate: Date,

    // === For OG (always has payment) ===
    cashAmount: Number,

    // === For RETURN ===
    returnReason: String,
    expectedReturnDate: Date,
    returnApproved: Boolean,
    returnedToSupplier: Boolean,
    returnDate: Date,

    // === For RECEIVED_FOR_OTHERS ===
    receivedFor: String,
    transferStatus: {
      type: String,
      enum: ['PENDING', 'TRANSFERRED', null]
    },
    transferDate: Date,

    // === Common ===
    remarks: String,
    location: String
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdByName: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// ===================
// INDEXES
// ===================
SerialNumberSchema.index({ serialNumber: 1 }, { unique: true });
SerialNumberSchema.index({ billId: 1 });
SerialNumberSchema.index({ billDate: 1 });
SerialNumberSchema.index({ currentCategory: 1 });
SerialNumberSchema.index({ billDate: 1, currentCategory: 1 });
SerialNumberSchema.index({ 'context.spuId': 1 });
SerialNumberSchema.index({ 'context.customerName': 1 });
SerialNumberSchema.index({ partName: 'text', serialNumber: 'text' });

// ===================
// MIDDLEWARE
// ===================

// After save, update bill summary
SerialNumberSchema.post('save', async function() {
  try {
    const Bill = mongoose.model('Bill');
    const bill = await Bill.findById(this.billId);
    if (bill) {
      await bill.updateCategorySummary();
    }
  } catch (error) {
    console.error('Error updating bill summary:', error);
  }
});

// After delete, update bill summary
SerialNumberSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const Bill = mongoose.model('Bill');
      const bill = await Bill.findById(doc.billId);
      if (bill) {
        await bill.updateCategorySummary();
      }
    } catch (error) {
      console.error('Error updating bill summary:', error);
    }
  }
});

module.exports = mongoose.model('SerialNumber', SerialNumberSchema);