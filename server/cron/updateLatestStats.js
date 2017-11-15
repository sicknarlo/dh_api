import Player from '../models/player.model';
import Rank from '../models/rank.model';

function updateLatestStats() {
  return new Promise((resolve) => {
    Player.index({}).then((players) => {
      players.forEach((player) => {
        let rank = 350;
        let value = 0;
        let low = 350;
        let high = 350;
        let stdev = 0;
        let trend = 0;
        let trend3 = 0;
        let trend6 = 0;
        let rank_2qb = 350;
        let value_2qb = 0;
        let low_2qb = 350;
        let high_2qb = 350;
        let stdev_2qb = 0;
        let trend_2qb = 0;
        let trend3_2qb = 0;
        let trend6_2qb = 0;
        Rank.getRanks({ playerId: player._id, format: 'ppr', limit: 6 }).then((ranks) => {
          Rank.getRanks({ playerId: player._id, format: 'super', limit: 6 }).then((ranks_2qb) => {
            rank = ranks[0].rank;
            value = ranks[0].value;
            low = ranks[0].low;
            high = ranks[0].high;
            stdev = ranks[0].stdev;
            trend = ranks[1] && ranks[1].rank - ranks[0].rank;
            trend3 = ranks[2] && ranks[2].rank - ranks[0].rank;
            trend6 = ranks[5] && ranks[5].rank - ranks[0].rank;
            rank_2qb = ranks_2qb[0].rank;
            value_2qb = ranks_2qb[0].value;
            low_2qb = ranks_2qb[0].low;
            high_2qb = ranks_2qb[0].high;
            stdev_2qb = ranks_2qb[0].stdev;
            trend_2qb = ranks_2qb[1] && ranks_2qb[1].rank - ranks_2qb[0].rank;
            trend3_2qb = ranks_2qb[2] && ranks_2qb[2].rank - ranks_2qb[0].rank;
            trend6_2qb = ranks_2qb[5] && ranks_2qb[5].rank - ranks_2qb[0].rank;
            Player.findOneAndUpdate(
              { _id: player._id },
              {
                $set: {
                  ranks: {
                    ppr: {
                      rank,
                      value,
                      low,
                      high,
                      stdev,
                      trend,
                      trend3,
                      trend6,
                    },
                    super: {
                      rank: rank_2qb,
                      value: value_2qb,
                      low: low_2qb,
                      high: high_2qb,
                      stdev: stdev_2qb,
                      trend: trend_2qb,
                      trend3: trend3_2qb,
                      trend6: trend6_2qb,
                    },
                  },
                },
              }
            ).exec();
          });
        });
      });
    });
    resolve(console.log('complete'));
  });
}

export default updateLatestStats;
