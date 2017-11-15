import Promise from 'bluebird';
import mongoose from 'mongoose';
import httpStatus from 'http-status';
import APIError from '../helpers/APIError';

/**
 * Rank Schema
 */
const RankSchema = new mongoose.Schema({
  type: {
    type: String
  },
  format: {
    type: String
  },
  rank: {
    type: Number
  },
  low: {
    type: Number
  },
  high: {
    type: Number
  },
  stdev: {
    type: Number
  },
  date: {
    type: Date
  },
  playerId: {
    type: String
  },
  value: {
    type: Number
  }
});

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */
RankSchema.pre('save', function (next) {
  const rank = this;
  rank.updatedAt = new Date();
  next();
});
/**
 * Methods
 */

/**
 * Statics
 */
RankSchema.statics = {
  /**
   * Get ranks for player
   * @param {ObjectId} id - The objectId of rank.
   * @returns {Promise<Rank[], APIError>}
   */
  getRanks({ playerId, limit = 10000, format = 'ppr' }) {
    return this.find({ playerId, format })
      .sort({ date: -1 })
      .limit(+limit)
      .exec()
      .then((Ranks) => {
        if (Ranks) {
          return Ranks;
        }
        const err = new APIError('No ranks found!', httpStatus.NOT_FOUND);
        return Promise.reject(err);
      });
  },

};

/**
 * @typedef Rank
 */
export default mongoose.model('Rank', RankSchema);
