/* Personal growth rates: character assets/角色成长值.xlsx, Sheet1!A1:I10 (%), updated 2026-11-16.
 * Class modifiers: Serenes Forest FE3H player growths, verified 2026-11-12.
 * Eight supplied stats only; movement and charm are not rolled. */
(function(global){
  'use strict';
  const M=global.MyGO=global.MyGO||{};
  const personal={
  "tomori": {
    "name": "高松灯",
    "rates": {
      "maxHp": 45,
      "str": 35,
      "mag": 30,
      "dex": 50,
      "spd": 55,
      "lck": 45,
      "def": 25,
      "res": 30
    }
  },
  "anon": {
    "name": "千早爱音",
    "rates": {
      "maxHp": 35,
      "str": 35,
      "mag": 20,
      "dex": 55,
      "spd": 50,
      "lck": 35,
      "def": 25,
      "res": 35
    }
  },
  "rana": {
    "name": "要乐奈",
    "rates": {
      "maxHp": 40,
      "str": 35,
      "mag": 35,
      "dex": 40,
      "spd": 60,
      "lck": 45,
      "def": 30,
      "res": 35
    }
  },
  "soyo": {
    "name": "长崎爽世",
    "rates": {
      "maxHp": 25,
      "str": 15,
      "mag": 60,
      "dex": 60,
      "spd": 50,
      "lck": 10,
      "def": 15,
      "res": 40
    }
  },
  "taki": {
    "name": "椎名立希",
    "rates": {
      "maxHp": 55,
      "str": 50,
      "mag": 25,
      "dex": 45,
      "spd": 35,
      "lck": 40,
      "def": 35,
      "res": 20
    }
  },
  "xueyue": {
    "name": "雪月",
    "rates": {
      "maxHp": 30,
      "str": 45,
      "mag": 30,
      "dex": 40,
      "spd": 50,
      "lck": 50,
      "def": 25,
      "res": 20
    }
  },
  "nina": {
    "name": "井芹仁菜",
    "rates": {
      "maxHp": 45,
      "str": 50,
      "mag": 20,
      "dex": 50,
      "spd": 45,
      "lck": 35,
      "def": 30,
      "res": 25
    }
  },
  "nijika": {
    "name": "伊地知虹夏",
    "rates": {
      "maxHp": 45,
      "str": 30,
      "mag": 35,
      "dex": 35,
      "spd": 35,
      "lck": 50,
      "def": 35,
      "res": 45
    }
  },
  "subaru": {
    "name": "安和昴",
    "rates": {
      "maxHp": 40,
      "str": 25,
      "mag": 65,
      "dex": 45,
      "spd": 30,
      "lck": 55,
      "def": 25,
      "res": 45
    }
  }
};
  const classRates={
  "commoner": {
    "maxHp": 0,
    "str": 0,
    "mag": 0,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": 0
  },
  "noble": {
    "maxHp": 0,
    "str": 0,
    "mag": 0,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": 0
  },
  "myrmidon": {
    "maxHp": 10,
    "str": 0,
    "mag": 0,
    "dex": 0,
    "spd": 5,
    "lck": 0,
    "def": 0,
    "res": -5
  },
  "soldier": {
    "maxHp": 10,
    "str": 0,
    "mag": 0,
    "dex": 5,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": -5
  },
  "fighter": {
    "maxHp": 10,
    "str": 5,
    "mag": 0,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": -5
  },
  "monk": {
    "maxHp": 5,
    "str": 0,
    "mag": 0,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": 5
  },
  "dancer": {
    "maxHp": 20,
    "str": -5,
    "mag": 0,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": -5,
    "res": -5
  },
  "mercenary": {
    "maxHp": 20,
    "str": 5,
    "mag": 0,
    "dex": 0,
    "spd": 5,
    "lck": 0,
    "def": 0,
    "res": -5
  },
  "thief": {
    "maxHp": 20,
    "str": 0,
    "mag": 0,
    "dex": 10,
    "spd": 10,
    "lck": 0,
    "def": 0,
    "res": 0
  },
  "armored_knight": {
    "maxHp": 20,
    "str": 0,
    "mag": 0,
    "dex": 0,
    "spd": -10,
    "lck": 0,
    "def": 10,
    "res": -5
  },
  "cavalier": {
    "maxHp": 20,
    "str": 5,
    "mag": 0,
    "dex": 5,
    "spd": -10,
    "lck": 0,
    "def": 5,
    "res": 0
  },
  "brigand": {
    "maxHp": 30,
    "str": 10,
    "mag": 0,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": -5
  },
  "archer": {
    "maxHp": 5,
    "str": 0,
    "mag": 0,
    "dex": 10,
    "spd": 0,
    "lck": 5,
    "def": 0,
    "res": 0
  },
  "brawler": {
    "maxHp": 30,
    "str": 0,
    "mag": -10,
    "dex": 10,
    "spd": 10,
    "lck": 0,
    "def": 0,
    "res": -10
  },
  "mage": {
    "maxHp": 5,
    "str": -5,
    "mag": 10,
    "dex": 5,
    "spd": 0,
    "lck": 0,
    "def": -5,
    "res": 5
  },
  "dark_mage": {
    "maxHp": 5,
    "str": -5,
    "mag": 10,
    "dex": 5,
    "spd": 0,
    "lck": 0,
    "def": -5,
    "res": 5
  },
  "priest": {
    "maxHp": 5,
    "str": -5,
    "mag": 5,
    "dex": 5,
    "spd": 0,
    "lck": 0,
    "def": -5,
    "res": 10
  },
  "pegasus_knight": {
    "maxHp": 15,
    "str": 0,
    "mag": 0,
    "dex": 0,
    "spd": 10,
    "lck": 0,
    "def": 0,
    "res": 5
  },
  "hero": {
    "maxHp": 30,
    "str": 10,
    "mag": 0,
    "dex": 0,
    "spd": 10,
    "lck": 0,
    "def": 0,
    "res": -5
  },
  "swordmaster": {
    "maxHp": 25,
    "str": 10,
    "mag": 0,
    "dex": 0,
    "spd": 20,
    "lck": 0,
    "def": 0,
    "res": -5
  },
  "assassin": {
    "maxHp": 20,
    "str": 0,
    "mag": 0,
    "dex": 20,
    "spd": 20,
    "lck": 0,
    "def": 0,
    "res": 0
  },
  "fortress_knight": {
    "maxHp": 30,
    "str": 10,
    "mag": 0,
    "dex": 0,
    "spd": -10,
    "lck": 0,
    "def": 15,
    "res": 0
  },
  "paladin": {
    "maxHp": 30,
    "str": 10,
    "mag": 0,
    "dex": 5,
    "spd": -10,
    "lck": 5,
    "def": 5,
    "res": 5
  },
  "wyvern_rider": {
    "maxHp": 30,
    "str": 10,
    "mag": -5,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": 5,
    "res": -5
  },
  "warrior": {
    "maxHp": 40,
    "str": 15,
    "mag": -5,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": 0
  },
  "sniper": {
    "maxHp": 10,
    "str": 5,
    "mag": 0,
    "dex": 20,
    "spd": 0,
    "lck": 10,
    "def": 0,
    "res": 0
  },
  "grappler": {
    "maxHp": 40,
    "str": 10,
    "mag": 0,
    "dex": 10,
    "spd": 10,
    "lck": 0,
    "def": 0,
    "res": 0
  },
  "warlock": {
    "maxHp": 10,
    "str": 0,
    "mag": 10,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": -5,
    "res": 5
  },
  "dark_bishop": {
    "maxHp": 10,
    "str": 0,
    "mag": 10,
    "dex": 0,
    "spd": 0,
    "lck": 0,
    "def": -5,
    "res": 5
  },
  "bishop": {
    "maxHp": 10,
    "str": 0,
    "mag": 10,
    "dex": 0,
    "spd": 0,
    "lck": 10,
    "def": -5,
    "res": 5
  },
  "falcon_knight": {
    "maxHp": 30,
    "str": 10,
    "mag": 0,
    "dex": 0,
    "spd": 20,
    "lck": 0,
    "def": 0,
    "res": 5
  },
  "wyvern_lord": {
    "maxHp": 30,
    "str": 15,
    "mag": -5,
    "dex": 0,
    "spd": 10,
    "lck": 0,
    "def": 5,
    "res": 0
  },
  "mortal_savant": {
    "maxHp": 20,
    "str": 10,
    "mag": 10,
    "dex": 0,
    "spd": -10,
    "lck": 10,
    "def": 0,
    "res": 0
  },
  "great_knight": {
    "maxHp": 30,
    "str": 10,
    "mag": 0,
    "dex": 0,
    "spd": -10,
    "lck": 0,
    "def": 5,
    "res": -5
  },
  "bow_knight": {
    "maxHp": 10,
    "str": 0,
    "mag": 0,
    "dex": 0,
    "spd": -5,
    "lck": 0,
    "def": 0,
    "res": 0
  },
  "dark_knight": {
    "maxHp": 10,
    "str": 5,
    "mag": 10,
    "dex": 0,
    "spd": -5,
    "lck": 0,
    "def": 5,
    "res": 10
  },
  "holy_knight": {
    "maxHp": 10,
    "str": 0,
    "mag": 10,
    "dex": 0,
    "spd": -5,
    "lck": 10,
    "def": 5,
    "res": 10
  },
  "gremory": {
    "maxHp": 10,
    "str": 0,
    "mag": 10,
    "dex": 10,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": 5
  },
  "war_master": {
    "maxHp": 40,
    "str": 15,
    "mag": 0,
    "dex": 0,
    "spd": 10,
    "lck": 0,
    "def": 0,
    "res": 0
  },
  "trickster": {
    "maxHp": 20,
    "str": 0,
    "mag": 0,
    "dex": 15,
    "spd": 20,
    "lck": 10,
    "def": 0,
    "res": 5
  },
  "war_monk": {
    "maxHp": 40,
    "str": 10,
    "mag": 5,
    "dex": 10,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": 5
  },
  "war_cleric": {
    "maxHp": 40,
    "str": 10,
    "mag": 5,
    "dex": 10,
    "spd": 0,
    "lck": 0,
    "def": 0,
    "res": 5
  },
  "dark_flier": {
    "maxHp": 20,
    "str": 0,
    "mag": 0,
    "dex": 0,
    "spd": 10,
    "lck": 0,
    "def": 0,
    "res": 10
  },
  "valkyrie": {
    "maxHp": 5,
    "str": 0,
    "mag": 5,
    "dex": 0,
    "spd": -5,
    "lck": 5,
    "def": 5,
    "res": 10
  }
};
  for(const p of Object.values(personal)){Object.freeze(p.rates);Object.freeze(p);}
  for(const rates of Object.values(classRates))Object.freeze(rates);
  M.GrowthData=Object.freeze({personal:Object.freeze(personal),classes:Object.freeze(classRates),
    keys:Object.freeze(['maxHp','str','mag','dex','spd','lck','def','res']),
    labels:Object.freeze({maxHp:'HP',str:'力量',mag:'魔力',dex:'技巧',spd:'速度',lck:'幸运',def:'守备',res:'魔防'})});
})(window);
