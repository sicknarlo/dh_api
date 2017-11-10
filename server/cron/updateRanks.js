require('es6-promise').polyfill();
require('isomorphic-fetch');

import Player from '../models/player.model';

function updateRanks() {
  // Get all players from database
  Player.index({}).then(players => {
    console.log(players.length);
    fetch(
      'http://partners.fantasypros.com/api/v1/consensus-rankings.php?experts=show&sport=NFL&year=2017&week=0&id=1015&scoring=PPR&position=ALL&type=STK'
    ).then(response => response.json())
    .then((ranks) => {
      console.log(ranks.players)
    });
  });

  // Loop through FP players and match with dfftools Player
}

export default updateRanks;
