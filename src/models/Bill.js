const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
  // Bill Identifiers
  voucherNumber: {
    type: String,
    required: [true, 'Voucher number is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [30, 'Voucher number cannot exceed 30 characters']
  },
  companyBillNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Company bill number cannot exceed 50 characters']
  },
  billDate: {
    type: Date,
    required: [true, 'Bill date is required'],
    index: true
  },

  // Supplier Reference
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Supplier is required']
  },
  supplierName: {
    type: String,
    trim: true
  },
  supplierCode: {
    type: String,
    trim: true
  },

  // Financial
  totalBillAmount: {
    type: Number,
    required: [true, 'Total bill amount is required'],
    min: [0, 'Total bill amount cannot be negative']
  },

  // Item Summary (computed/updated when serials change)
  totalSerialNumbers: {
    type: Number,
    default: 0
  },
  categorySummary: {
    IN_STOCK: { type: Number, default: 0 },
    SPU_PENDING: { type: Number, default: 0 },
    SPU_CLEARED: { type: Number, default: 0 },
    AMC: { type: Number, default: 0 },
    OG: { type: Number, default: 0 },
    RETURN: { type: Number, default: 0 },
    RECEIVED_FOR_OTHERS: { type: Number, default: 0 },
    UNCATEGORIZED: { type: Number, default: 0 }
  },
  totalCategorizedValue: {
    type: Number,
    default: 0
  },

  // Status
  isFullyCategorized: {
    type: Boolean,
    default: false
  },

  // Metadata
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  receivedByName: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// ===================
// INDEXES
// ===================
BillSchema.index({ voucherNumber: 1 }, { unique: true });
BillSchema.index({ billDate: -1 });
BillSchema.index({ supplierId: 1 });
BillSchema.index({ billDate: 1, 'categorySummary.IN_STOCK': 1 });
BillSchema.index({ isFullyCategorized: 1 });
BillSchema.index({ createdAt: -1 });

// ===================
// VIRTUALS
// ===================

// Get serial numbers for this bill
BillSchema.virtual('serialNumbers', {
  ref: 'SerialNumber',
  localField: '_id',
  foreignField: 'billId'
});

// Ensure virtuals are included in JSON
BillSchema.set('toJSON', { virtuals: true });
BillSchema.set('toObject', { virtuals: true });

// ===================
// METHODS
// ===================

// Update category summary (call after serial number changes)
BillSchema.methods.updateCategorySummary = async function() {
  const SerialNumber = mongoose.model('SerialNumber');
  
  const summary = await SerialNumber.aggregate([
    { $match: { billId: this._id } },
    { 
      $group: { 
        _id: '$currentCategory',
        count: { $sum: 1 },
        value: { $sum: '$unitPrice' }
      } 
    }
  ]);

  // Reset summary
  this.categorySummary = {
    IN_STOCK: 0,
    SPU_PENDING: 0,
    SPU_CLEARED: 0,
    AMC: 0,
    OG: 0,
    RETURN: 0,
    RECEIVED_FOR_OTHERS: 0,
    UNCATEGORIZED: 0
  };

  let totalSerials = 0;
  let totalValue = 0;

  summary.forEach(item => {
    if (this.categorySummary.hasOwnProperty(item._id)) {
      this.categorySummary[item._id] = item.count;
    }
    totalSerials += item.count;
    totalValue += item.value;
  });

  this.totalSerialNumbers = totalSerials;
  this.totalCategorizedValue = totalValue;
  this.isFullyCategorized = this.categorySummary.UNCATEGORIZED === 0 && totalSerials > 0;

  await this.save();
};

module.exports = mongoose.model('Bill', BillSchema);