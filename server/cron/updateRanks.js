import Player from '../models/player.model';
import Rank from '../models/rank.model';
import { aav_raw } from './aav';

require('es6-promise').polyfill();
require('isomorphic-fetch');

const superScore = {
  QB: ecr => parseFloat((0.0162 * Math.pow(ecr, 1.66) - 0.69).toFixed(2)),
  RB: ecr => parseFloat((1.6912 * Math.pow(ecr, 0.9441) - 0.69).toFixed(2)),
  WR: ecr => parseFloat((1.6912 * Math.pow(ecr, 0.9441) - 0.69).toFixed(2)),
  TE: ecr => parseFloat((1.6912 * Math.pow(ecr, 0.9441) - 0.69).toFixed(2)),
};

const draftYears = ['2018', '2019', '2020', '2021', '2022'];

const positions = ['QB', 'WR', 'RB', 'TE'];

function cleanName(name) {
  if (name === 'Mitchell Trubisky') return 'Mitch Trubisky';
  if (name === 'Robert Kelley') return 'Rob Kelley';
  return name.replace(' Jr.', '').replace(/\./g, '');
}

function standardDeviation(values) {
  const avg = average(values);

  const squareDiffs = values.map((value) => {
    const diff = value - avg;
    const sqrDiff = diff * diff;
    return sqrDiff;
  });

  const avgSquareDiff = average(squareDiffs);

  const stdDev = parseFloat(Math.sqrt(avgSquareDiff).toFixed(2));
  return stdDev;
}

function average(data) {
  const sum = data.reduce((s, value) => s + value, 0);

  const avg = sum / data.length;
  return avg;
}

const aav = aav_raw.map(x => parseFloat(x.averageValue));

function updateRanks() {
  fetch(
    'http://partners.fantasypros.com/api/v1/consensus-rankings.php?experts=show&sport=NFL&year=2017&week=0&id=1015&scoring=PPR&position=ALL&type=STK'
  )
    .then(response => response.json())
    .then((json) => {
      const players = json.players
        .filter(y => positions.indexOf(y.player_position_id) > -1)
        .map((x, i) => {
          const name = cleanName(x.player_name);
          const best = parseInt(x.rank_min);
          const worst = parseInt(x.rank_max);
          const rank = parseFloat(x.rank_ave);
          const stdev = parseFloat(x.rank_std);
          const pos = x.player_position_id;
          return {
            name,
            best,
            worst,
            rank,
            stdev,
            pos,
            super: superScore[pos](rank),
          };
        });
      const playersFinal = players.map((x) => {
        const obj = x;
        const diff = obj.super - obj.rank;
        obj.stdev_2qb = obj.stdev;
        obj.best_2qb = obj.best + diff > 1 ? Math.floor(obj.best + diff) : 1;
        obj.worst_2qb = obj.worst + diff > 1 ? Math.ceil(obj.worst) + diff : 2;
        return obj;
      });
      Player.index({}).then((result) => {
        playersFinal.forEach((player) => {
          const dbPlayer = result.find(
            x => x.name && x.name.toLowerCase() === player.name.toLowerCase()
          );
          if (dbPlayer) player.player = dbPlayer;
          if (dbPlayer && dbPlayer.status === 'R') player.isRookie = true;
        });
        playersFinal.sort((a, b) => a.rank - b.rank);
        let last = null;
        for (let y = 0; y < playersFinal.length; y++) {
          playersFinal[y].aav = parseFloat((aav[y] / 1000).toFixed(5));
          playersFinal[y].value = parseInt(
            10500 * Math.pow(2.71828182845904, -0.0234 * playersFinal[y].rank)
          );
          // last = playersFinal[y];
        }
        playersFinal.sort((a, b) => a.super - b.super);
        last = null;
        let rank = 1;
        for (let y = 0; y < playersFinal.length; y++) {
          if (last && playersFinal[y].super !== last.super) {
            rank++;
          }
          playersFinal[y].aav_2qb = parseFloat((aav[y] / 1000).toFixed(5));
          playersFinal[y].value_2qb = parseInt(
            10500 * Math.pow(2.71828182845904, -0.0234 * playersFinal[y].super)
          );
          last = playersFinal[y];
        }
        const rookies = playersFinal.filter(x => x.isRookie).sort((a, b) => a.rank - b.rank);

        rookies.forEach((x, i) => {
          const p = playersFinal.findIndex(y => x.name === y.name);
          if (p) {
            playersFinal[p].rookie = i + 1;
            //   console.log(playersFinal[p]);
          }
        });
        const rookies_2qb = playersFinal.filter(x => x.isRookie).sort((a, b) => a.super - b.super);

        rookies_2qb.forEach((x, i) => {
          const p = playersFinal.findIndex(y => x.name === y.name);
          if (p) {
            playersFinal[p].rookie_2qb = i + 1;
          }
        });
        const round1 = [];
        const round2 = [];
        const round3 = [];
        const round4 = [];
        let lastDefined = null;
        for (let y = 0; y < 48; y++) {
          if (rookies[y] && rookies_2qb[y]) lastDefined = y;
          if (y < 12) round1.push([rookies[lastDefined], rookies_2qb[lastDefined]]);
          if (y > 11 && y < 24) round2.push([rookies[lastDefined], rookies_2qb[lastDefined]]);
          if (y > 23 && y < 36) round3.push([rookies[lastDefined], rookies_2qb[lastDefined]]);
          if (y > 35 && y < 48) round4.push([rookies[lastDefined], rookies_2qb[lastDefined]]);
        }

        const year1 = [];

        round1.forEach((x, index) =>
          year1.push({
            name: `2018 Pick ${index + 1}`,
            round: 1,
            rank: {
              time: new Date(),
              adp: x[0].rank,
              adp_2qb: x[1].super,
              low: x[0].best,
              low_2qb: x[1].best_2qb,
              high: x[0].worst,
              high_2qb: x[1].worst_2qb,
              stdev: x[0].stdev,
              stdev_2qb: x[1].stdev_2qb,
              value: x[0].value,
              value_2qb: x[1].value_2qb,
            },
          })
        );

        round2.forEach((x, index) =>
          year1.push({
            name: `2018 Pick ${index + 1 + 12}`,
            round: 2,
            rank: {
              time: new Date(),
              adp: x[0].rank,
              adp_2qb: x[1].super,
              low: x[0].best,
              low_2qb: x[1].best_2qb,
              high: x[0].worst,
              high_2qb: x[1].worst_2qb,
              stdev: x[0].stdev,
              stdev_2qb: x[1].stdev_2qb,
              value: x[0].value,
              value_2qb: x[1].value_2qb,
            },
          })
        );

        round3.forEach((x, index) =>
          year1.push({
            name: `2018 Pick ${index + 1 + 24}`,
            round: 3,
            rank: {
              time: new Date(),
              adp: x[0].rank,
              adp_2qb: x[1].super,
              low: x[0].best,
              low_2qb: x[1].best_2qb,
              high: x[0].worst,
              high_2qb: x[1].worst_2qb,
              stdev: x[0].stdev,
              stdev_2qb: x[1].stdev_2qb,
              value: x[0].value,
              value_2qb: x[1].value_2qb,
            },
          })
        );

        round4.forEach((x, index) =>
          year1.push({
            name: `2018 Pick ${index + 1 + 36}`,
            round: 4,
            rank: {
              time: new Date(),
              adp: x[0].rank,
              adp_2qb: x[1].super,
              low: x[0].best,
              low_2qb: x[1].best_2qb,
              high: x[0].worst,
              high_2qb: x[1].worst_2qb,
              stdev: x[0].stdev,
              stdev_2qb: x[1].stdev_2qb,
              value: x[0].value,
              value_2qb: x[1].value_2qb,
            },
          })
        );

        const pickRanks = [...year1];

        pickRanks.push({
          name: '2018 1st',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 1) acc += val.rank.adp;
                return acc;
              }, 0) / 12
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 1) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 12
            ),
            low: year1[0].rank.adp,
            low_2qb: year1[0].rank.adp_2qb,
            high: year1[11].rank.adp,
            high_2qb: year1[11].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val) => {
                if (val.round === 1) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val) => {
                if (val.round === 1) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 1) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 12
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 1) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 12
            ),
          },
        });

        pickRanks.push({
          name: '2018 Early 1st',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i < 4) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i < 4) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[0].rank.adp,
            low_2qb: year1[0].rank.adp_2qb,
            high: year1[3].rank.adp,
            high_2qb: year1[3].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i < 4) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i < 4) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i < 4) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i < 4) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        pickRanks.push({
          name: '2018 Mid 1st',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 3 && i < 8) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 3 && i < 8) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[4].rank.adp,
            low_2qb: year1[4].rank.adp_2qb,
            high: year1[7].rank.adp,
            high_2qb: year1[7].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 3 && i < 8) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 3 && i < 8) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 3 && i < 8) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 3 && i < 8) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        pickRanks.push({
          name: '2018 Late 1st',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 7 && i < 12) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 7 && i < 12) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[8].rank.adp,
            low_2qb: year1[8].rank.adp_2qb,
            high: year1[11].rank.adp,
            high_2qb: year1[11].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 7 && i < 12) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 7 && i < 12) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 7 && i < 12) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 7 && i < 12) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        // Second round
        pickRanks.push({
          name: '2018 2nd',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 2) acc += val.rank.adp;
                return acc;
              }, 0) / 12
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 2) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 12
            ),
            low: year1[12].rank.adp,
            low_2qb: year1[12].rank.adp_2qb,
            high: year1[23].rank.adp,
            high_2qb: year1[23].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val) => {
                if (val.round === 2) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val) => {
                if (val.round === 2) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 2) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 12
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 2) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 12
            ),
          },
        });

        pickRanks.push({
          name: '2018 Early 2nd',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 11 && i < 16) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 11 && i < 16) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[12].rank.adp,
            low_2qb: year1[12].rank.adp_2qb,
            high: year1[15].rank.adp,
            high_2qb: year1[15].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 11 && i < 16) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 11 && i < 16) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 11 && i < 16) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 11 && i < 16) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        pickRanks.push({
          name: '2018 Mid 2nd',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 15 && i < 20) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 15 && i < 20) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[16].rank.adp,
            low_2qb: year1[16].rank.adp_2qb,
            high: year1[19].rank.adp,
            high_2qb: year1[19].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 15 && i < 20) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 15 && i < 20) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 15 && i < 20) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 15 && i < 20) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        pickRanks.push({
          name: '2018 Late 2nd',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 19 && i < 24) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 19 && i < 24) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[20].rank.adp,
            low_2qb: year1[20].rank.adp_2qb,
            high: year1[23].rank.adp,
            high_2qb: year1[23].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 19 && i < 24) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 19 && i < 24) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 19 && i < 24) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 19 && i < 24) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        // Third round
        pickRanks.push({
          name: '2018 3rd',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 3) acc += val.rank.adp;
                return acc;
              }, 0) / 12
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 3) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 12
            ),
            low: year1[24].rank.adp,
            low_2qb: year1[24].rank.adp_2qb,
            high: year1[35].rank.adp,
            high_2qb: year1[35].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val) => {
                if (val.round === 3) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val) => {
                if (val.round === 3) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 3) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 12
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 3) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 12
            ),
          },
        });

        pickRanks.push({
          name: '2018 Early 3rd',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 23 && i < 28) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 23 && i < 28) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[24].rank.adp,
            low_2qb: year1[24].rank.adp_2qb,
            high: year1[27].rank.adp,
            high_2qb: year1[27].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 23 && i < 28) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 23 && i < 28) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 23 && i < 28) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 23 && i < 28) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        pickRanks.push({
          name: '2018 Mid 3rd',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 27 && i < 32) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 27 && i < 32) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[28].rank.adp,
            low_2qb: year1[28].rank.adp_2qb,
            high: year1[31].rank.adp,
            high_2qb: year1[31].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 27 && i < 32) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 27 && i < 32) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 27 && i < 32) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 27 && i < 32) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        pickRanks.push({
          name: '2018 Late 3rd',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 31 && i < 36) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 31 && i < 36) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[32].rank.adp,
            low_2qb: year1[32].rank.adp_2qb,
            high: year1[35].rank.adp,
            high_2qb: year1[35].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 31 && i < 36) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 31 && i < 36) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 31 && i < 36) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 31 && i < 36) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        // Fourth round
        pickRanks.push({
          name: '2018 4th',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 4) acc += val.rank.adp;
                return acc;
              }, 0) / 12
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 4) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 12
            ),
            low: year1[36].rank.adp,
            low_2qb: year1[36].rank.adp_2qb,
            high: year1[47].rank.adp,
            high_2qb: year1[47].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val) => {
                if (val.round === 4) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val) => {
                if (val.round === 4) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 4) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 12
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val) => {
                if (val.round === 4) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 12
            ),
          },
        });

        pickRanks.push({
          name: '2018 Early 4th',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 35 && i < 40) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 35 && i < 40) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[36].rank.adp,
            low_2qb: year1[36].rank.adp_2qb,
            high: year1[39].rank.adp,
            high_2qb: year1[39].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 35 && i < 40) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 35 && i < 40) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 35 && i < 40) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 35 && i < 40) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        pickRanks.push({
          name: '2018 Mid 4th',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 39 && i < 44) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 39 && i < 44) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[40].rank.adp,
            low_2qb: year1[40].rank.adp_2qb,
            high: year1[43].rank.adp,
            high_2qb: year1[43].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 39 && i < 44) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 39 && i < 44) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 39 && i < 44) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 39 && i < 44) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        pickRanks.push({
          name: '2018 Late 4th',
          rank: {
            time: new Date(),
            adp: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 43 && i < 48) acc += val.rank.adp;
                return acc;
              }, 0) / 4
            ),
            adp_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 43 && i < 48) acc += val.rank.adp_2qb;
                return acc;
              }, 0) / 4
            ),
            low: year1[44].rank.adp,
            low_2qb: year1[44].rank.adp_2qb,
            high: year1[47].rank.adp,
            high_2qb: year1[47].rank.adp_2qb,
            stdev: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 43 && i < 48) {
                  acc.push(val.rank.adp);
                }
                return acc;
              }, [])
            ),
            stdev_2qb: standardDeviation(
              year1.reduce((acc, val, i) => {
                if (i > 43 && i < 48) {
                  acc.push(val.rank.adp_2qb);
                }
                return acc;
              }, [])
            ),
            value: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 43 && i < 48) {
                  acc += val.rank.value;
                }
                return acc;
              }, 0) / 4
            ),
            value_2qb: Math.round(
              year1.reduce((acc, val, i) => {
                if (i > 43 && i < 48) {
                  acc += val.rank.value_2qb;
                }
                return acc;
              }, 0) / 4
            ),
          },
        });

        const futureYears = ['2019', '2020', '2021', '2022'];

        const absolutePicks = pickRanks.slice(0, 48);

        futureYears.forEach((year, i) => {
          let x = 0;
          if (i === 0) {
            absolutePicks.some((pick, index) => {
              if (index > 47) return false;
              const pickNum = index + 1;
              pickRanks.push({
                name: `${year} Pick ${pickNum}`,
                rank: {
                  time: new Date(),
                  adp: parseFloat((pick.rank.adp * 1.2).toFixed(1)),
                  adp_2qb: parseFloat((pick.rank.adp_2qb * 1.2).toFixed(1)),
                  low: parseFloat((pick.rank.low * 1.2).toFixed(1)),
                  low_2qb: parseFloat((pick.rank.low_2qb * 1.2).toFixed(1)),
                  high: parseFloat((pick.rank.high * 1.2).toFixed(1)),
                  high_2qb: parseFloat((pick.rank.high_2qb * 1.2).toFixed(1)),
                  stdev: pick.rank.stdev,
                  stdev_2qb: pick.rank.stdev_2qb,
                  value: parseInt((pick.rank.value * 0.8).toFixed(0)),
                  value_2qb: parseInt((pick.rank.value_2qb * 0.8).toFixed(0)),
                },
              });
            });
          }
          let foo = 112;
          let inc = 0;

          x = i === 0 ? 48 + inc : foo + (i - 1) * 16;

          foo++;
          pickRanks.push({
            name: `${year} 1st`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 52 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} 2nd`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 56 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} 3rd`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 60 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} 4th`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          inc++;
          x = i === 0 ? 48 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Early 1st`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 52 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Early 2nd`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 56 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Early 3rd`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 60 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Early 4th`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          inc++;
          x = i === 0 ? 48 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Mid 1st`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 52 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Mid 2nd`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 56 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Mid 3rd`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 60 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Mid 4th`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          inc++;
          x = i === 0 ? 48 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Late 1st`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 52 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Late 2nd`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 56 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Late 3rd`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
          x = i === 0 ? 60 + inc : foo + (i - 1) * 16;

          foo++;

          pickRanks.push({
            name: `${year} Late 4th`,
            rank: {
              time: new Date(),
              adp: parseFloat((pickRanks[x].rank.adp * 1.2).toFixed(1)),
              adp_2qb: parseFloat((pickRanks[x].rank.adp_2qb * 1.2).toFixed(1)),
              low: parseFloat((pickRanks[x].rank.low * 1.2).toFixed(1)),
              low_2qb: parseFloat((pickRanks[x].rank.low_2qb * 1.2).toFixed(1)),
              high: parseFloat((pickRanks[x].rank.high * 1.2).toFixed(1)),
              high_2qb: parseFloat((pickRanks[x].rank.high_2qb * 1.2).toFixed(1)),
              stdev: pickRanks[x].rank.stdev,
              stdev_2qb: pickRanks[x].rank.stdev_2qb,
              value: parseInt((pickRanks[x].rank.value * 0.8).toFixed(0)),
              value_2qb: parseInt((pickRanks[x].rank.value_2qb * 0.8).toFixed(0)),
            },
          });
        });
        result.forEach((p) => {
          if (p.position !== 'PICK') {
            const match = playersFinal.find(x => x.name.toLowerCase() === p.name.toLowerCase());
            const newPprRank = new Rank({
              playerId: p._id.toString(),
              format: 'ppr',
              date: new Date(),
              rank: match ? match.rank : 350,
              low: match ? match.best : 350,
              high: match ? match.worst : 350,
              stdev: match ? match.stdev : 0,
              value: match ? match.value : 0,
              aav: match ? match.aav : 0,
            });
            const newSuperRank = new Rank({
              playerId: p._id.toString(),
              format: 'super',
              date: new Date(),
              rank: match ? match.super : 350,
              low: match ? match.best_2qb : 350,
              high: match ? match.worst_2qb : 350,
              stdev: match ? match.stdev_2qb : 0,
              value: match ? match.value_2qb : 0,
              aav: match ? match.aav_2qb : 0,
            });
            newPprRank.save((err, thingy) => {
              if (err) return console.error(err);
              // return console.log(thingy);
            });
            newSuperRank.save((err, thingy) => {
              if (err) return console.error(err);
              // return console.log(thingy);
            });
          } else {
            const match = pickRanks.find(x => x.name === p.name);
            if (match) {
              const newPprRank = new Rank({
                playerId: p._id.toString(),
                format: 'ppr',
                date: new Date(),
                rank: match ? match.rank.adp : 350,
                low: match ? match.rank.low : 350,
                high: match ? match.rank.high : 350,
                stdev: match ? match.rank.stdev : 0,
                value: match ? match.rank.value : 0,
              });
              const newSuperRank = new Rank({
                playerId: p._id.toString(),
                format: 'super',
                date: new Date(),
                rank: match ? match.rank.adp_qb : 350,
                low: match ? match.rank.low_2qb : 350,
                high: match ? match.rank.high_2qb : 350,
                stdev: match ? match.rank.stdev_2qb : 0,
                value: match ? match.rank.value_2qb : 0,
              });
              newPprRank.save((err, thingy) => {
                if (err) return console.error(err);
                // return console.log(thingy);
              });
              newSuperRank.save((err, thingy) => {
                if (err) return console.error(err);
                // return console.log(thingy);
              });
            }
          }
        });
      });
    });

  // Loop through FP players and match with dfftools Player
}

export default updateRanks;
