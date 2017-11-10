import Player from '../models/player.model';

require('es6-promise').polyfill();
require('isomorphic-fetch');

function formatNameForMatch(name, pos) {
  return `${name.toLowerCase().replace(/[^a-zA-Z0-9]/g,'')}${pos.toLowerCase()}`;
}

function cleanNameNewPlayer(name) {
  const newName = `${name.split(', ')[1]} ${name.split(', ')[0]}`
  if (name === 'Mitchell Trubisky') return 'Mitch Trubisky';
  if (name === 'Robert Kelley') return 'Rob Kelley';
  return name.replace(' Jr.', '').replace(/\./g, '').replace(/\\/g, '');
}

function cleanName(name) {
  if (name === 'Mitchell Trubisky') return 'Mitch Trubisky';
  if (name === 'Robert Kelley') return 'Rob Kelley';
  return name.replace(' Jr.', '').replace(/\./g, '');
}

// const supportedPositions = ['CB', 'DE', 'DT', 'LB', 'PK', 'PN', 'QB', 'RB', 'S', 'TE', 'WR'];
const supportedPositions = ['QB', 'RB', 'TE', 'WR'];

function updatePlayers() {
  fetch('https://www70.myfantasyleague.com/2017/export?TYPE=players&DETAILS=1&SINCE=&PLAYERS=&JSON=1')
    .then(response => response.json()).then((json) => {
      const mflData = json.players.player.filter(x => supportedPositions.includes(x.position));
      const usedMflPlayers = [];
      Player.index({}).then((players) => {
        players.forEach((player) => {
          let match = null;
          mflData.forEach((x) => {
            const cleanedName = cleanNameNewPlayer(x.name);
            if (
              player.mflId === x.id ||
              formatNameForMatch(player.name, player.position) === formatNameForMatch(cleanedName, x.position)
            ) {
              match = x;
              usedMflPlayers.push(x.id);
            }
          });
          if (player.position !== 'PICK') {
            if (match) {
              Player.findOneAndUpdate({ _id: player._id }, {
                $set: {
                  position: match.position,
                  team: match.team,
                  draft_year: Number(match.draft_year),
                  mflId: match.id,
                  twitter_username: match.twitter_username,
                  stats_id: match.stats_id,
                  weight: match.weight ? Number(match.weight) : null,
                  college: match.college,
                  draft_round: match.draft_round,
                  height: match.height ? Number(match.height) : null,
                  rotoworld_id: match.rotoworld_id,
                  nfl_id: match.nfl_id ? match.nfl_id.split('/')[1] : null,
                  espn_id: match.espn_id,
                  birthdate: match.birthdate ? new Date(Number(match.birthdate) * 1000) : null,
                  status: match.status,
                  armchair_id: match.armchair_id,
                  stats_global_id: match.stats_global_id,
                  kffl_id: match.kffl_id,
                  draft_team: match.draft_team,
                  draft_pick: match.draft_pick,
                  jersey: match.jersey,
                  cbs_id: match.cbs_id,
                  sportsdata_id: match.sportsdata_id,
                  updatedAt: new Date(),
                }
              }).exec();
            } else {
              Player.findOneAndUpdate({ _id: player._id }, {
                $set: {
                  status: 'inactive',
                  updatedAt: new Date(),
                }
              }).exec();
            }
          }
        });
        mflData.forEach((item) => {
          if (!usedMflPlayers.includes(item.id)) {
            const newPlayer = new Player({
              name: cleanNameNewPlayer(item.name),
              position: item.position,
              team: item.team,
              draft_year: Number(item.draft_year),
              mflId: item.id,
              twitter_username: item.twitter_username,
              stats_id: item.stats_id,
              weight: item.weight ? Number(item.weight) : null,
              college: item.college,
              draft_round: item.draft_round,
              height: item.height ? Number(item.height) : null,
              rotoworld_id: item.rotoworld_id,
              nfl_id: item.nfl_id ? item.nfl_id.split('/')[1] : null,
              espn_id: item.espn_id,
              birthdate: item.birthdate ? new Date(Number(item.birthdate) * 1000) : null,
              status: item.status,
              armchair_id: item.armchair_id,
              stats_global_id: item.stats_global_id,
              kffl_id: item.kffl_id,
              draft_team: item.draft_team,
              draft_pick: item.draft_pick,
              jersey: item.jersey,
              cbs_id: item.cbs_id,
              sportsdata_id: item.sportsdata_id,
              updatedAt: new Date(),
              createdAt: new Date()
            });
            newPlayer.save(function (err, np) {
              if (err) return console.error(err);
            }).exec();
          }
        });
      });
    });
}

export default updatePlayers;
