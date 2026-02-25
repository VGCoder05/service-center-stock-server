const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  customerCode: {
    type: Number,
    unique: true,
    sparse: true, // Allow null but enforce uniqueness when present
    uppercase: true,
    trim: true,
    maxlength: [20, 'Customer code cannot exceed 20 characters']
},
ticketNumber: {
    type: Number,
    unique: true,
    sparse: true, // Allow null but enforce uniqueness when present
    trim: true,
    maxlength: [20, 'Must give ticket number']
  },
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [150, 'Customer name cannot exceed 150 characters']
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: [100, 'Contact person cannot exceed 100 characters']
  },
  phone: {
    type: Number,
    trim: true,
    maxlength: [20, 'Phone cannot exceed 20 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  // AMC Details
  hasAMC: {
    type: Boolean,
    default: false
  },
  amcDetails: {
    amcNumber: {
      type: String,
      trim: true
    },
    startDate: Date,
    endDate: Date,
    equipmentCovered: {
      type: String,
      trim: true,
      maxlength: [500, 'Equipment covered cannot exceed 500 characters']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ===================
// INDEXES
// ===================
CustomerSchema.index({ customerCode: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ customerName: 'text' });
CustomerSchema.index({ hasAMC: 1 });
CustomerSchema.index({ isActive: 1 });

// ===================
// VIRTUAL: Check if AMC is active
// ===================
CustomerSchema.virtual('isAMCActive').get(function() {
  if (!this.hasAMC || !this.amcDetails?.endDate) return false;
  return new Date(this.amcDetails.endDate) >= new Date();
});

// Ensure virtuals are included in JSON
CustomerSchema.set('toJSON', { virtuals: true });
CustomerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', CustomerSchema);