import Promise from 'bluebird';
import mongoose from 'mongoose';
import httpStatus from 'http-status';
import cache from 'memory-cache';
import APIError from '../helpers/APIError';

/**
 * Player Schema
 */
const PlayerSchema = new mongoose.Schema({
  legacyId: {
    type: String
  },
  mflId: {
    type: String
  },
  name: {
    type: String
  },
  position: {
    type: String
  },
  team: {
    type: String
  },
  draft_year: {
    type: Number
  },
  twitter_username: {
    type: String
  },
  stats_id: {
    type: String
  },
  weight: {
    type: Number
  },
  college: {
    type: String
  },
  draft_round: {
    type: String
  },
  height: {
    type: Number
  },
  rotoworld_id: {
    type: String
  },
  nfl_id: {
    type: String
  },
  espn_id: {
    type: String
  },
  birthdate: {
    type: Date
  },
  status: {
    type: String
  },
  armchair_id: {
    type: String
  },
  stats_global_id: {
    type: String
  },
  kffl_id: {
    type: String
  },
  draft_team: {
    type: String
  },
  draft_pick: {
    type: String
  },
  jersey: {
    type: String
  },
  cbs_id: {
    type: String
  },
  sportsdata_id: {
    type: String
  },
  fp_id: {
    type: String
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  }
});

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */
PlayerSchema.pre('save', function (next) {
  const user = this;
  user.updatedAt = new Date();
  next();
});
/**
 * Methods
 */

/**
 * Statics
 */
PlayerSchema.statics = {
  /**
   * Get user
   * @param {ObjectId} id - The objectId of user.
   * @returns {Promise<User, APIError>}
   */
  get(id) {
    if (id) {
      return new Promise((resolve, reject) => {
        const player = cache.get(id);
        if (player) resolve(player);
        this.findById(id)
          .exec()
          .then((p) => {
            if (!p) return reject(new APIError('No such player exists!', httpStatus.NOT_FOUND));
            cache.put(id, p);
            return resolve(p);
          });
      });
    }
    return Promise.reject(new APIError('Must provide playerId!', httpStatus.NOT_FOUND));
  },

  index({ activeOnly = false }) {
    return new Promise((resolve) => {
      let players = cache.get('players');
      if (players) {
        console.log('from cache');
        if (!activeOnly) return resolve(players);
        return resolve(players.filter(x => x.status !== 'inactive'));
      }
      return this.find()
        .exec()
        .then((p) => {
          players = p;
          cache.put('players', p);
          console.log('from db');
          if (!activeOnly) return resolve(players);
          return resolve(players.filter(x => x.status !== 'inactive'));
        });
    });
  },

  /**
   * List players in descending order of 'createdAt' timestamp.
   * @param {number} skip - Number of users to be skipped.
   * @param {number} limit - Limit number of users to be returned.
   * @returns {Promise<User[]>}
   */
  list({ skip = 0, limit = 50 } = {}) {
    return this.find()
      .sort({ createdAt: -1 })
      .skip(+skip)
      .limit(+limit)
      .exec();
  }
};

/**
 * @typedef User
 */
export default mongoose.model('Player', PlayerSchema);
