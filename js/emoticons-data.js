/**
 * Animated GIF Emoticon Library (199 Icons)
 * Replaces static emoji icons with animated GIF icons
 */
(function(window) {
  'use strict';

  const EMOTICONS_LIST = [
  {
    "name": "airplane",
    "file": "airplane.gif",
    "title": "Airplane",
    "category": "activity",
    "shortcode": ":airplane:",
    "aliases": [
      "\u2708\ufe0f"
    ]
  },
  {
    "name": "alarm_clock",
    "file": "alarm_clock.gif",
    "title": "Alarm Clock",
    "category": "symbols",
    "shortcode": ":alarm_clock:",
    "aliases": [
      "\u23f0"
    ]
  },
  {
    "name": "alien",
    "file": "alien.gif",
    "title": "Alien",
    "category": "symbols",
    "shortcode": ":alien:",
    "aliases": [
      "\ud83d\udc7d"
    ]
  },
  {
    "name": "automobile",
    "file": "automobile.gif",
    "title": "Automobile",
    "category": "activity",
    "shortcode": ":automobile:",
    "aliases": [
      "\ud83d\ude97",
      ":car:"
    ]
  },
  {
    "name": "backhand_index_pointing_down",
    "file": "backhand_index_pointing_down.gif",
    "title": "Backhand Index Pointing Down",
    "category": "people",
    "shortcode": ":backhand_index_pointing_down:",
    "aliases": [
      "\ud83d\udc47"
    ]
  },
  {
    "name": "backhand_index_pointing_left",
    "file": "backhand_index_pointing_left.gif",
    "title": "Backhand Index Pointing Left",
    "category": "people",
    "shortcode": ":backhand_index_pointing_left:",
    "aliases": [
      "\ud83d\udc48"
    ]
  },
  {
    "name": "backhand_index_pointing_right",
    "file": "backhand_index_pointing_right.gif",
    "title": "Backhand Index Pointing Right",
    "category": "people",
    "shortcode": ":backhand_index_pointing_right:",
    "aliases": [
      "\ud83d\udc49"
    ]
  },
  {
    "name": "backhand_index_pointing_up",
    "file": "backhand_index_pointing_up.gif",
    "title": "Backhand Index Pointing Up",
    "category": "people",
    "shortcode": ":backhand_index_pointing_up:",
    "aliases": [
      "\ud83d\udc46"
    ]
  },
  {
    "name": "beaming_face_with_smiling_eyes",
    "file": "beaming_face_with_smiling_eyes.gif",
    "title": "Beaming Face With Smiling Eyes",
    "category": "faces",
    "shortcode": ":beaming_face_with_smiling_eyes:",
    "aliases": [
      "\ud83d\ude01",
      ":beam:"
    ]
  },
  {
    "name": "birthday_cake",
    "file": "birthday_cake.gif",
    "title": "Birthday Cake",
    "category": "food",
    "shortcode": ":birthday_cake:",
    "aliases": [
      "\ud83c\udf82",
      ":cake:"
    ]
  },
  {
    "name": "bomb",
    "file": "bomb.gif",
    "title": "Bomb",
    "category": "symbols",
    "shortcode": ":bomb:",
    "aliases": [
      "\ud83d\udca3"
    ]
  },
  {
    "name": "bottle_with_popping_cork",
    "file": "bottle_with_popping_cork.gif",
    "title": "Bottle With Popping Cork",
    "category": "food",
    "shortcode": ":bottle_with_popping_cork:",
    "aliases": [
      "\ud83c\udf7e",
      ":champagne:"
    ]
  },
  {
    "name": "bowling",
    "file": "bowling.gif",
    "title": "Bowling",
    "category": "nature",
    "shortcode": ":bowling:",
    "aliases": [
      "\ud83c\udfb3"
    ]
  },
  {
    "name": "broken_heart",
    "file": "broken_heart.gif",
    "title": "Broken Heart",
    "category": "symbols",
    "shortcode": ":broken_heart:",
    "aliases": [
      "\ud83d\udc94"
    ]
  },
  {
    "name": "butterfly",
    "file": "butterfly.gif",
    "title": "Butterfly",
    "category": "nature",
    "shortcode": ":butterfly:",
    "aliases": [
      "\ud83e\udd8b"
    ]
  },
  {
    "name": "camera_with_flash",
    "file": "camera_with_flash.gif",
    "title": "Camera With Flash",
    "category": "symbols",
    "shortcode": ":camera_with_flash:",
    "aliases": [
      "\ud83d\udcf8",
      ":camera:"
    ]
  },
  {
    "name": "cat_with_tears_of_joy",
    "file": "cat_with_tears_of_joy.gif",
    "title": "Cat With Tears Of Joy",
    "category": "nature",
    "shortcode": ":cat_with_tears_of_joy:",
    "aliases": [
      "\ud83d\udc31",
      ":cat:"
    ]
  },
  {
    "name": "check_mark_button",
    "file": "check_mark_button.gif",
    "title": "Check Mark Button",
    "category": "symbols",
    "shortcode": ":check_mark_button:",
    "aliases": [
      "\u2705"
    ]
  },
  {
    "name": "christmas_tree",
    "file": "christmas_tree.gif",
    "title": "Christmas Tree",
    "category": "symbols",
    "shortcode": ":christmas_tree:",
    "aliases": [
      "\ud83c\udf84"
    ]
  },
  {
    "name": "clapper_board",
    "file": "clapper_board.gif",
    "title": "Clapper Board",
    "category": "symbols",
    "shortcode": ":clapper_board:",
    "aliases": [
      "\ud83c\udfac"
    ]
  },
  {
    "name": "clapping_hands",
    "file": "clapping_hands.gif",
    "title": "Clapping Hands",
    "category": "people",
    "shortcode": ":clapping_hands:",
    "aliases": [
      "\ud83d\udc4f",
      ":clap:"
    ]
  },
  {
    "name": "clinking_beer_mugs",
    "file": "clinking_beer_mugs.gif",
    "title": "Clinking Beer Mugs",
    "category": "food",
    "shortcode": ":clinking_beer_mugs:",
    "aliases": [
      "\ud83c\udf7b",
      ":beer:"
    ]
  },
  {
    "name": "clinking_glasses",
    "file": "clinking_glasses.gif",
    "title": "Clinking Glasses",
    "category": "symbols",
    "shortcode": ":clinking_glasses:",
    "aliases": [
      "\ud83e\udd42",
      ":cheers:"
    ]
  },
  {
    "name": "clock",
    "file": "clock.gif",
    "title": "Clock",
    "category": "symbols",
    "shortcode": ":clock:",
    "aliases": [
      "\ud83d\udd52"
    ]
  },
  {
    "name": "collision",
    "file": "collision.gif",
    "title": "Collision",
    "category": "symbols",
    "shortcode": ":collision:",
    "aliases": [
      "\ud83d\udca5",
      ":boom:"
    ]
  },
  {
    "name": "confetti_ball",
    "file": "confetti_ball.gif",
    "title": "Confetti Ball",
    "category": "activity",
    "shortcode": ":confetti_ball:",
    "aliases": [
      "\ud83c\udf8a"
    ]
  },
  {
    "name": "cow_face",
    "file": "cow_face.gif",
    "title": "Cow Face",
    "category": "faces",
    "shortcode": ":cow_face:",
    "aliases": [
      "\ud83d\udc2e",
      ":cow:"
    ]
  },
  {
    "name": "cowboy_hat_face",
    "file": "cowboy_hat_face.gif",
    "title": "Cowboy Hat Face",
    "category": "faces",
    "shortcode": ":cowboy_hat_face:",
    "aliases": [
      "\ud83e\udd20",
      ":cowboy:"
    ]
  },
  {
    "name": "crossed_fingers",
    "file": "crossed_fingers.gif",
    "title": "Crossed Fingers",
    "category": "people",
    "shortcode": ":crossed_fingers:",
    "aliases": [
      "\ud83e\udd1e"
    ]
  },
  {
    "name": "crown",
    "file": "crown.gif",
    "title": "Crown",
    "category": "symbols",
    "shortcode": ":crown:",
    "aliases": [
      "\ud83d\udc51"
    ]
  },
  {
    "name": "crying_face",
    "file": "crying_face.gif",
    "title": "Crying Face",
    "category": "faces",
    "shortcode": ":crying_face:",
    "aliases": [
      "\ud83d\ude22"
    ]
  },
  {
    "name": "desert_island",
    "file": "desert_island.gif",
    "title": "Desert Island",
    "category": "nature",
    "shortcode": ":desert_island:",
    "aliases": [
      "\ud83c\udfdd\ufe0f"
    ]
  },
  {
    "name": "direct_hit",
    "file": "direct_hit.gif",
    "title": "Direct Hit",
    "category": "symbols",
    "shortcode": ":direct_hit:",
    "aliases": [
      "\ud83c\udfaf",
      ":target:"
    ]
  },
  {
    "name": "dizzy_face",
    "file": "dizzy_face.gif",
    "title": "Dizzy Face",
    "category": "faces",
    "shortcode": ":dizzy_face:",
    "aliases": [
      "\ud83d\ude35",
      ":dizzy:"
    ]
  },
  {
    "name": "dog_face",
    "file": "dog_face.gif",
    "title": "Dog Face",
    "category": "faces",
    "shortcode": ":dog_face:",
    "aliases": [
      "\ud83d\udc36",
      ":dog:"
    ]
  },
  {
    "name": "drooling_face",
    "file": "drooling_face.gif",
    "title": "Drooling Face",
    "category": "faces",
    "shortcode": ":drooling_face:",
    "aliases": [
      "\ud83e\udd24",
      ":drool:"
    ]
  },
  {
    "name": "drum",
    "file": "drum.gif",
    "title": "Drum",
    "category": "symbols",
    "shortcode": ":drum:",
    "aliases": [
      "\ud83e\udd41"
    ]
  },
  {
    "name": "exploding_head",
    "file": "exploding_head.gif",
    "title": "Exploding Head",
    "category": "symbols",
    "shortcode": ":exploding_head:",
    "aliases": [
      "\ud83e\udd2f",
      ":mindblown:"
    ]
  },
  {
    "name": "eyes",
    "file": "eyes.gif",
    "title": "Eyes",
    "category": "symbols",
    "shortcode": ":eyes:",
    "aliases": [
      "\ud83d\udc40"
    ]
  },
  {
    "name": "face_blowing_a_kiss",
    "file": "face_blowing_a_kiss.gif",
    "title": "Face Blowing A Kiss",
    "category": "faces",
    "shortcode": ":face_blowing_a_kiss:",
    "aliases": [
      "\ud83d\ude18",
      ":kiss:"
    ]
  },
  {
    "name": "face_screaming_in_fear",
    "file": "face_screaming_in_fear.gif",
    "title": "Face Screaming In Fear",
    "category": "faces",
    "shortcode": ":face_screaming_in_fear:",
    "aliases": [
      "\ud83d\ude31",
      ":scream:"
    ]
  },
  {
    "name": "face_vomiting",
    "file": "face_vomiting.gif",
    "title": "Face Vomiting",
    "category": "faces",
    "shortcode": ":face_vomiting:",
    "aliases": [
      "\ud83e\udd2e",
      ":vomit:"
    ]
  },
  {
    "name": "face_with_head_bandage",
    "file": "face_with_head_bandage.gif",
    "title": "Face With Head Bandage",
    "category": "faces",
    "shortcode": ":face_with_head_bandage:",
    "aliases": [
      "\ud83e\udd15",
      ":hurt:"
    ]
  },
  {
    "name": "face_with_monocle",
    "file": "face_with_monocle.gif",
    "title": "Face With Monocle",
    "category": "faces",
    "shortcode": ":face_with_monocle:",
    "aliases": [
      "\ud83e\uddd0",
      ":monocle:"
    ]
  },
  {
    "name": "face_with_rolling_eyes",
    "file": "face_with_rolling_eyes.gif",
    "title": "Face With Rolling Eyes",
    "category": "faces",
    "shortcode": ":face_with_rolling_eyes:",
    "aliases": [
      "\ud83d\ude44",
      ":roll_eyes:"
    ]
  },
  {
    "name": "face_with_steam_from_nose",
    "file": "face_with_steam_from_nose.gif",
    "title": "Face With Steam From Nose",
    "category": "faces",
    "shortcode": ":face_with_steam_from_nose:",
    "aliases": [
      "\ud83d\ude24",
      ":triumph:"
    ]
  },
  {
    "name": "face_with_symbols_on_mouth",
    "file": "face_with_symbols_on_mouth.gif",
    "title": "Face With Symbols On Mouth",
    "category": "faces",
    "shortcode": ":face_with_symbols_on_mouth:",
    "aliases": [
      "\ud83e\udd2c",
      ":curse:"
    ]
  },
  {
    "name": "face_with_tears_of_joy",
    "file": "face_with_tears_of_joy.gif",
    "title": "Face With Tears Of Joy",
    "category": "faces",
    "shortcode": ":face_with_tears_of_joy:",
    "aliases": [
      "\ud83d\ude02",
      ":joy:",
      ":lol:"
    ]
  },
  {
    "name": "face_with_thermometer",
    "file": "face_with_thermometer.gif",
    "title": "Face With Thermometer",
    "category": "faces",
    "shortcode": ":face_with_thermometer:",
    "aliases": [
      "\ud83e\udd12",
      ":sick:"
    ]
  },
  {
    "name": "fairy",
    "file": "fairy.gif",
    "title": "Fairy",
    "category": "people",
    "shortcode": ":fairy:",
    "aliases": []
  },
  {
    "name": "ferris_wheel",
    "file": "ferris_wheel.gif",
    "title": "Ferris Wheel",
    "category": "activity",
    "shortcode": ":ferris_wheel:",
    "aliases": [
      "\ud83c\udfa1"
    ]
  },
  {
    "name": "fire",
    "file": "fire.gif",
    "title": "Fire",
    "category": "symbols",
    "shortcode": ":fire:",
    "aliases": [
      "\ud83d\udd25"
    ]
  },
  {
    "name": "fire_engine",
    "file": "fire_engine.gif",
    "title": "Fire Engine",
    "category": "symbols",
    "shortcode": ":fire_engine:",
    "aliases": [
      "\ud83d\ude92"
    ]
  },
  {
    "name": "fireworks",
    "file": "fireworks.gif",
    "title": "Fireworks",
    "category": "symbols",
    "shortcode": ":fireworks:",
    "aliases": [
      "\ud83c\udf86"
    ]
  },
  {
    "name": "fish",
    "file": "fish.gif",
    "title": "Fish",
    "category": "nature",
    "shortcode": ":fish:",
    "aliases": [
      "\ud83d\udc1f"
    ]
  },
  {
    "name": "fishing_pole",
    "file": "fishing_pole.gif",
    "title": "Fishing Pole",
    "category": "nature",
    "shortcode": ":fishing_pole:",
    "aliases": [
      "\ud83c\udfa3"
    ]
  },
  {
    "name": "flag_in_hole",
    "file": "flag_in_hole.gif",
    "title": "Flag In Hole",
    "category": "symbols",
    "shortcode": ":flag_in_hole:",
    "aliases": []
  },
  {
    "name": "flexed_biceps",
    "file": "flexed_biceps.gif",
    "title": "Flexed Biceps",
    "category": "people",
    "shortcode": ":flexed_biceps:",
    "aliases": [
      "\ud83d\udcaa",
      ":muscle:"
    ]
  },
  {
    "name": "flushed_face",
    "file": "flushed_face.gif",
    "title": "Flushed Face",
    "category": "faces",
    "shortcode": ":flushed_face:",
    "aliases": [
      "\ud83d\ude33",
      ":flushed:"
    ]
  },
  {
    "name": "flying_saucer",
    "file": "flying_saucer.gif",
    "title": "Flying Saucer",
    "category": "faces",
    "shortcode": ":flying_saucer:",
    "aliases": [
      "\ud83d\udef8",
      ":ufo:"
    ]
  },
  {
    "name": "frog",
    "file": "frog.gif",
    "title": "Frog",
    "category": "nature",
    "shortcode": ":frog:",
    "aliases": [
      "\ud83d\udc38"
    ]
  },
  {
    "name": "frowning_face",
    "file": "frowning_face.gif",
    "title": "Frowning Face",
    "category": "faces",
    "shortcode": ":frowning_face:",
    "aliases": [
      "\u2639\ufe0f",
      "\ud83d\ude41",
      ":frown:"
    ]
  },
  {
    "name": "ghost",
    "file": "ghost.gif",
    "title": "Ghost",
    "category": "symbols",
    "shortcode": ":ghost:",
    "aliases": [
      "\ud83d\udc7b"
    ]
  },
  {
    "name": "globe",
    "file": "globe.gif",
    "title": "Globe",
    "category": "symbols",
    "shortcode": ":globe:",
    "aliases": [
      "\ud83c\udf0d",
      "\ud83c\udf0e"
    ]
  },
  {
    "name": "grinning_face_with_smiling_eyes",
    "file": "grinning_face_with_smiling_eyes.gif",
    "title": "Grinning Face With Smiling Eyes",
    "category": "faces",
    "shortcode": ":grinning_face_with_smiling_eyes:",
    "aliases": [
      "\ud83d\ude04",
      ":smile:"
    ]
  },
  {
    "name": "grinning_squinting_face",
    "file": "grinning_squinting_face.gif",
    "title": "Grinning Squinting Face",
    "category": "faces",
    "shortcode": ":grinning_squinting_face:",
    "aliases": [
      "\ud83d\ude06",
      ":squint:"
    ]
  },
  {
    "name": "growing_heart",
    "file": "growing_heart.gif",
    "title": "Growing Heart",
    "category": "symbols",
    "shortcode": ":growing_heart:",
    "aliases": [
      "\ud83d\udc97"
    ]
  },
  {
    "name": "hamburger",
    "file": "hamburger.gif",
    "title": "Hamburger",
    "category": "food",
    "shortcode": ":hamburger:",
    "aliases": [
      "\ud83c\udf54",
      ":burger:"
    ]
  },
  {
    "name": "handshake",
    "file": "handshake.gif",
    "title": "Handshake",
    "category": "people",
    "shortcode": ":handshake:",
    "aliases": [
      "\ud83e\udd1d"
    ]
  },
  {
    "name": "hear_no_evil_monkey",
    "file": "hear_no_evil_monkey.gif",
    "title": "Hear No Evil Monkey",
    "category": "nature",
    "shortcode": ":hear_no_evil_monkey:",
    "aliases": []
  },
  {
    "name": "heart_with_arrow",
    "file": "heart_with_arrow.gif",
    "title": "Heart With Arrow",
    "category": "symbols",
    "shortcode": ":heart_with_arrow:",
    "aliases": [
      "\ud83d\udc98"
    ]
  },
  {
    "name": "helicopter",
    "file": "helicopter.gif",
    "title": "Helicopter",
    "category": "activity",
    "shortcode": ":helicopter:",
    "aliases": [
      "\ud83d\ude81"
    ]
  },
  {
    "name": "honeybee",
    "file": "honeybee.gif",
    "title": "Honeybee",
    "category": "nature",
    "shortcode": ":honeybee:",
    "aliases": [
      "\ud83d\udc1d",
      ":bee:"
    ]
  },
  {
    "name": "horse",
    "file": "horse.gif",
    "title": "Horse",
    "category": "nature",
    "shortcode": ":horse:",
    "aliases": [
      "\ud83d\udc34"
    ]
  },
  {
    "name": "hot_beverage",
    "file": "hot_beverage.gif",
    "title": "Hot Beverage",
    "category": "food",
    "shortcode": ":hot_beverage:",
    "aliases": [
      "\u2615",
      ":coffee:"
    ]
  },
  {
    "name": "hot_face",
    "file": "hot_face.gif",
    "title": "Hot Face",
    "category": "faces",
    "shortcode": ":hot_face:",
    "aliases": [
      "\ud83e\udd75",
      ":hot:"
    ]
  },
  {
    "name": "hugging_face",
    "file": "hugging_face.gif",
    "title": "Hugging Face",
    "category": "faces",
    "shortcode": ":hugging_face:",
    "aliases": [
      "\ud83e\udd17",
      ":hug:"
    ]
  },
  {
    "name": "hundred_points",
    "file": "hundred_points.gif",
    "title": "Hundred Points",
    "category": "symbols",
    "shortcode": ":hundred_points:",
    "aliases": [
      "\ud83d\udcaf",
      ":100:"
    ]
  },
  {
    "name": "hushed_face",
    "file": "hushed_face.gif",
    "title": "Hushed Face",
    "category": "faces",
    "shortcode": ":hushed_face:",
    "aliases": [
      "\ud83d\ude2e",
      "\ud83d\ude2f",
      ":hushed:"
    ]
  },
  {
    "name": "jack_o_lantern",
    "file": "jack_o_lantern.gif",
    "title": "Jack O Lantern",
    "category": "symbols",
    "shortcode": ":jack_o_lantern:",
    "aliases": []
  },
  {
    "name": "kangaroo",
    "file": "kangaroo.gif",
    "title": "Kangaroo",
    "category": "nature",
    "shortcode": ":kangaroo:",
    "aliases": []
  },
  {
    "name": "kiss_mark",
    "file": "kiss_mark.gif",
    "title": "Kiss Mark",
    "category": "symbols",
    "shortcode": ":kiss_mark:",
    "aliases": [
      "\ud83d\udc8b"
    ]
  },
  {
    "name": "light_bulb",
    "file": "light_bulb.gif",
    "title": "Light Bulb",
    "category": "symbols",
    "shortcode": ":light_bulb:",
    "aliases": [
      "\ud83d\udca1"
    ]
  },
  {
    "name": "locomotive",
    "file": "locomotive.gif",
    "title": "Locomotive",
    "category": "activity",
    "shortcode": ":locomotive:",
    "aliases": [
      "\ud83d\ude82",
      ":train:"
    ]
  },
  {
    "name": "loudly_crying_face",
    "file": "loudly_crying_face.gif",
    "title": "Loudly Crying Face",
    "category": "faces",
    "shortcode": ":loudly_crying_face:",
    "aliases": [
      "\ud83d\ude2d",
      ":sob:",
      ":cry:"
    ]
  },
  {
    "name": "love_you_gesture",
    "file": "love_you_gesture.gif",
    "title": "Love You Gesture",
    "category": "symbols",
    "shortcode": ":love_you_gesture:",
    "aliases": [
      "\ud83e\udd1f",
      ":ily:"
    ]
  },
  {
    "name": "lying_face",
    "file": "lying_face.gif",
    "title": "Lying Face",
    "category": "faces",
    "shortcode": ":lying_face:",
    "aliases": [
      "\ud83e\udd25",
      ":liar:"
    ]
  },
  {
    "name": "man_biking",
    "file": "man_biking.gif",
    "title": "Man Biking",
    "category": "people",
    "shortcode": ":man_biking:",
    "aliases": []
  },
  {
    "name": "man_dancing",
    "file": "man_dancing.gif",
    "title": "Man Dancing",
    "category": "people",
    "shortcode": ":man_dancing:",
    "aliases": []
  },
  {
    "name": "man_facepalming",
    "file": "man_facepalming.gif",
    "title": "Man Facepalming",
    "category": "faces",
    "shortcode": ":man_facepalming:",
    "aliases": []
  },
  {
    "name": "man_fairy",
    "file": "man_fairy.gif",
    "title": "Man Fairy",
    "category": "people",
    "shortcode": ":man_fairy:",
    "aliases": []
  },
  {
    "name": "man_juggling",
    "file": "man_juggling.gif",
    "title": "Man Juggling",
    "category": "people",
    "shortcode": ":man_juggling:",
    "aliases": []
  },
  {
    "name": "man_raising_hand",
    "file": "man_raising_hand.gif",
    "title": "Man Raising Hand",
    "category": "people",
    "shortcode": ":man_raising_hand:",
    "aliases": []
  },
  {
    "name": "man_running",
    "file": "man_running.gif",
    "title": "Man Running",
    "category": "people",
    "shortcode": ":man_running:",
    "aliases": []
  },
  {
    "name": "man_shrugging",
    "file": "man_shrugging.gif",
    "title": "Man Shrugging",
    "category": "people",
    "shortcode": ":man_shrugging:",
    "aliases": []
  },
  {
    "name": "man_tipping_hand",
    "file": "man_tipping_hand.gif",
    "title": "Man Tipping Hand",
    "category": "people",
    "shortcode": ":man_tipping_hand:",
    "aliases": []
  },
  {
    "name": "man_zombie",
    "file": "man_zombie.gif",
    "title": "Man Zombie",
    "category": "people",
    "shortcode": ":man_zombie:",
    "aliases": []
  },
  {
    "name": "men_with_bunny_ears",
    "file": "men_with_bunny_ears.gif",
    "title": "Men With Bunny Ears",
    "category": "people",
    "shortcode": ":men_with_bunny_ears:",
    "aliases": []
  },
  {
    "name": "middle_finger",
    "file": "middle_finger.gif",
    "title": "Middle Finger",
    "category": "people",
    "shortcode": ":middle_finger:",
    "aliases": [
      "\ud83d\udd95"
    ]
  },
  {
    "name": "money_mouth_face",
    "file": "money_mouth_face.gif",
    "title": "Money Mouth Face",
    "category": "faces",
    "shortcode": ":money_mouth_face:",
    "aliases": [
      "\ud83e\udd11",
      ":rich:"
    ]
  },
  {
    "name": "money_with_wings",
    "file": "money_with_wings.gif",
    "title": "Money With Wings",
    "category": "symbols",
    "shortcode": ":money_with_wings:",
    "aliases": [
      "\ud83d\udcb8"
    ]
  },
  {
    "name": "musical_notes",
    "file": "musical_notes.gif",
    "title": "Musical Notes",
    "category": "symbols",
    "shortcode": ":musical_notes:",
    "aliases": [
      "\ud83c\udfb5",
      "\ud83c\udfb6",
      ":music:"
    ]
  },
  {
    "name": "nerd_face",
    "file": "nerd_face.gif",
    "title": "Nerd Face",
    "category": "faces",
    "shortcode": ":nerd_face:",
    "aliases": [
      "\ud83e\udd13",
      ":nerd:"
    ]
  },
  {
    "name": "oncoming_fist",
    "file": "oncoming_fist.gif",
    "title": "Oncoming Fist",
    "category": "people",
    "shortcode": ":oncoming_fist:",
    "aliases": [
      "\ud83d\udc4a",
      ":fist:"
    ]
  },
  {
    "name": "oncoming_police_car",
    "file": "oncoming_police_car.gif",
    "title": "Oncoming Police Car",
    "category": "activity",
    "shortcode": ":oncoming_police_car:",
    "aliases": [
      "\ud83d\ude93"
    ]
  },
  {
    "name": "owl",
    "file": "owl.gif",
    "title": "Owl",
    "category": "nature",
    "shortcode": ":owl:",
    "aliases": [
      "\ud83e\udd89"
    ]
  },
  {
    "name": "pancakes",
    "file": "pancakes.gif",
    "title": "Pancakes",
    "category": "food",
    "shortcode": ":pancakes:",
    "aliases": [
      "\ud83e\udd5e"
    ]
  },
  {
    "name": "party_popper",
    "file": "party_popper.gif",
    "title": "Party Popper",
    "category": "symbols",
    "shortcode": ":party_popper:",
    "aliases": [
      "\ud83c\udf89"
    ]
  },
  {
    "name": "partying_face",
    "file": "partying_face.gif",
    "title": "Partying Face",
    "category": "faces",
    "shortcode": ":partying_face:",
    "aliases": [
      "\ud83e\udd73",
      ":party:"
    ]
  },
  {
    "name": "peace_symbol",
    "file": "peace_symbol.gif",
    "title": "Peace Symbol",
    "category": "symbols",
    "shortcode": ":peace_symbol:",
    "aliases": [
      "\u262e\ufe0f"
    ]
  },
  {
    "name": "penguin",
    "file": "penguin.gif",
    "title": "Penguin",
    "category": "nature",
    "shortcode": ":penguin:",
    "aliases": [
      "\ud83d\udc27"
    ]
  },
  {
    "name": "people_with_bunny_ears",
    "file": "people_with_bunny_ears.gif",
    "title": "People With Bunny Ears",
    "category": "people",
    "shortcode": ":people_with_bunny_ears:",
    "aliases": []
  },
  {
    "name": "person_biking",
    "file": "person_biking.gif",
    "title": "Person Biking",
    "category": "people",
    "shortcode": ":person_biking:",
    "aliases": []
  },
  {
    "name": "person_facepalming",
    "file": "person_facepalming.gif",
    "title": "Person Facepalming",
    "category": "faces",
    "shortcode": ":person_facepalming:",
    "aliases": []
  },
  {
    "name": "person_juggling",
    "file": "person_juggling.gif",
    "title": "Person Juggling",
    "category": "people",
    "shortcode": ":person_juggling:",
    "aliases": []
  },
  {
    "name": "person_raising_hand",
    "file": "person_raising_hand.gif",
    "title": "Person Raising Hand",
    "category": "people",
    "shortcode": ":person_raising_hand:",
    "aliases": []
  },
  {
    "name": "person_running",
    "file": "person_running.gif",
    "title": "Person Running",
    "category": "people",
    "shortcode": ":person_running:",
    "aliases": []
  },
  {
    "name": "person_shrugging",
    "file": "person_shrugging.gif",
    "title": "Person Shrugging",
    "category": "people",
    "shortcode": ":person_shrugging:",
    "aliases": []
  },
  {
    "name": "person_tipping_hand",
    "file": "person_tipping_hand.gif",
    "title": "Person Tipping Hand",
    "category": "people",
    "shortcode": ":person_tipping_hand:",
    "aliases": []
  },
  {
    "name": "pig_face",
    "file": "pig_face.gif",
    "title": "Pig Face",
    "category": "faces",
    "shortcode": ":pig_face:",
    "aliases": [
      "\ud83d\udc37",
      ":pig:"
    ]
  },
  {
    "name": "pile_of_poo",
    "file": "pile_of_poo.gif",
    "title": "Pile Of Poo",
    "category": "symbols",
    "shortcode": ":pile_of_poo:",
    "aliases": [
      "\ud83d\udca9",
      ":poop:"
    ]
  },
  {
    "name": "pistol",
    "file": "pistol.gif",
    "title": "Pistol",
    "category": "symbols",
    "shortcode": ":pistol:",
    "aliases": [
      "\ud83d\udd2b",
      ":gun:"
    ]
  },
  {
    "name": "pleading_face",
    "file": "pleading_face.gif",
    "title": "Pleading Face",
    "category": "faces",
    "shortcode": ":pleading_face:",
    "aliases": [
      "\ud83e\udd7a",
      ":plead:"
    ]
  },
  {
    "name": "police_car_light",
    "file": "police_car_light.gif",
    "title": "Police Car Light",
    "category": "activity",
    "shortcode": ":police_car_light:",
    "aliases": [
      "\ud83d\udea8"
    ]
  },
  {
    "name": "popcorn",
    "file": "popcorn.gif",
    "title": "Popcorn",
    "category": "food",
    "shortcode": ":popcorn:",
    "aliases": [
      "\ud83c\udf7f"
    ]
  },
  {
    "name": "pouting_face",
    "file": "pouting_face.gif",
    "title": "Pouting Face",
    "category": "faces",
    "shortcode": ":pouting_face:",
    "aliases": [
      "\ud83d\ude21",
      ":angry:"
    ]
  },
  {
    "name": "prohibited",
    "file": "prohibited.gif",
    "title": "Prohibited",
    "category": "symbols",
    "shortcode": ":prohibited:",
    "aliases": [
      "\ud83d\udeab"
    ]
  },
  {
    "name": "rabbit_face",
    "file": "rabbit_face.gif",
    "title": "Rabbit Face",
    "category": "faces",
    "shortcode": ":rabbit_face:",
    "aliases": [
      "\ud83d\udc30",
      ":rabbit:"
    ]
  },
  {
    "name": "rainbow_flag",
    "file": "rainbow_flag.gif",
    "title": "Rainbow Flag",
    "category": "symbols",
    "shortcode": ":rainbow_flag:",
    "aliases": [
      "\ud83c\udff3\ufe0f\u200d\ud83c\udf08"
    ]
  },
  {
    "name": "raising_hands",
    "file": "raising_hands.gif",
    "title": "Raising Hands",
    "category": "people",
    "shortcode": ":raising_hands:",
    "aliases": [
      "\ud83d\ude4c",
      ":raised_hands:"
    ]
  },
  {
    "name": "relieved_face",
    "file": "relieved_face.gif",
    "title": "Relieved Face",
    "category": "faces",
    "shortcode": ":relieved_face:",
    "aliases": [
      "\ud83d\ude0c",
      ":relieved:"
    ]
  },
  {
    "name": "revolving_hearts",
    "file": "revolving_hearts.gif",
    "title": "Revolving Hearts",
    "category": "symbols",
    "shortcode": ":revolving_hearts:",
    "aliases": [
      "\ud83d\udc9e"
    ]
  },
  {
    "name": "ring",
    "file": "ring.gif",
    "title": "Ring",
    "category": "symbols",
    "shortcode": ":ring:",
    "aliases": [
      "\ud83d\udc8d"
    ]
  },
  {
    "name": "robot",
    "file": "robot.gif",
    "title": "Robot",
    "category": "symbols",
    "shortcode": ":robot:",
    "aliases": [
      "\ud83e\udd16"
    ]
  },
  {
    "name": "rocket",
    "file": "rocket.gif",
    "title": "Rocket",
    "category": "activity",
    "shortcode": ":rocket:",
    "aliases": [
      "\ud83d\ude80"
    ]
  },
  {
    "name": "roller_coaster",
    "file": "roller_coaster.gif",
    "title": "Roller Coaster",
    "category": "activity",
    "shortcode": ":roller_coaster:",
    "aliases": [
      "\ud83c\udfa2"
    ]
  },
  {
    "name": "rolling_on_the_floor_laughing",
    "file": "rolling_on_the_floor_laughing.gif",
    "title": "Rolling On The Floor Laughing",
    "category": "faces",
    "shortcode": ":rolling_on_the_floor_laughing:",
    "aliases": [
      "\ud83e\udd23",
      ":rofl:"
    ]
  },
  {
    "name": "rooster",
    "file": "rooster.gif",
    "title": "Rooster",
    "category": "nature",
    "shortcode": ":rooster:",
    "aliases": []
  },
  {
    "name": "sandwich",
    "file": "sandwich.gif",
    "title": "Sandwich",
    "category": "food",
    "shortcode": ":sandwich:",
    "aliases": [
      "\ud83e\udd6a"
    ]
  },
  {
    "name": "santa_claus",
    "file": "santa_claus.gif",
    "title": "Santa Claus",
    "category": "people",
    "shortcode": ":santa_claus:",
    "aliases": [
      "\ud83c\udf85",
      ":santa:"
    ]
  },
  {
    "name": "see_no_evil_monkey",
    "file": "see_no_evil_monkey.gif",
    "title": "See No Evil Monkey",
    "category": "nature",
    "shortcode": ":see_no_evil_monkey:",
    "aliases": []
  },
  {
    "name": "shushing_face",
    "file": "shushing_face.gif",
    "title": "Shushing Face",
    "category": "faces",
    "shortcode": ":shushing_face:",
    "aliases": [
      "\ud83e\udd2b",
      ":shh:"
    ]
  },
  {
    "name": "sleeping_face",
    "file": "sleeping_face.gif",
    "title": "Sleeping Face",
    "category": "faces",
    "shortcode": ":sleeping_face:",
    "aliases": [
      "\ud83d\ude34",
      ":sleep:"
    ]
  },
  {
    "name": "slot_machine",
    "file": "slot_machine.gif",
    "title": "Slot Machine",
    "category": "symbols",
    "shortcode": ":slot_machine:",
    "aliases": [
      "\ud83c\udfb0"
    ]
  },
  {
    "name": "sloth",
    "file": "sloth.gif",
    "title": "Sloth",
    "category": "nature",
    "shortcode": ":sloth:",
    "aliases": [
      "\ud83e\udda5"
    ]
  },
  {
    "name": "smiling_face",
    "file": "smiling_face.gif",
    "title": "Smiling Face",
    "category": "faces",
    "shortcode": ":smiling_face:",
    "aliases": [
      "\ud83d\ude0a",
      ":happy:"
    ]
  },
  {
    "name": "smiling_face_with_halo",
    "file": "smiling_face_with_halo.gif",
    "title": "Smiling Face With Halo",
    "category": "faces",
    "shortcode": ":smiling_face_with_halo:",
    "aliases": [
      "\ud83d\ude07",
      ":angel:"
    ]
  },
  {
    "name": "smiling_face_with_heart_eyes",
    "file": "smiling_face_with_heart_eyes.gif",
    "title": "Smiling Face With Heart Eyes",
    "category": "faces",
    "shortcode": ":smiling_face_with_heart_eyes:",
    "aliases": [
      "\ud83d\ude0d",
      ":heart_eyes:",
      ":love:"
    ]
  },
  {
    "name": "smiling_face_with_hearts",
    "file": "smiling_face_with_hearts.gif",
    "title": "Smiling Face With Hearts",
    "category": "faces",
    "shortcode": ":smiling_face_with_hearts:",
    "aliases": [
      "\ud83e\udd70",
      ":blush_hearts:"
    ]
  },
  {
    "name": "smiling_face_with_horns",
    "file": "smiling_face_with_horns.gif",
    "title": "Smiling Face With Horns",
    "category": "faces",
    "shortcode": ":smiling_face_with_horns:",
    "aliases": [
      "\ud83d\ude08",
      ":devil:"
    ]
  },
  {
    "name": "smiling_face_with_sunglasses",
    "file": "smiling_face_with_sunglasses.gif",
    "title": "Smiling Face With Sunglasses",
    "category": "faces",
    "shortcode": ":smiling_face_with_sunglasses:",
    "aliases": [
      "\ud83d\ude0e",
      ":cool:"
    ]
  },
  {
    "name": "smirking_face",
    "file": "smirking_face.gif",
    "title": "Smirking Face",
    "category": "faces",
    "shortcode": ":smirking_face:",
    "aliases": [
      "\ud83d\ude0f",
      ":smirk:"
    ]
  },
  {
    "name": "snake",
    "file": "snake.gif",
    "title": "Snake",
    "category": "nature",
    "shortcode": ":snake:",
    "aliases": [
      "\ud83d\udc0d"
    ]
  },
  {
    "name": "sneezing_face",
    "file": "sneezing_face.gif",
    "title": "Sneezing Face",
    "category": "faces",
    "shortcode": ":sneezing_face:",
    "aliases": [
      "\ud83e\udd27",
      ":sneeze:"
    ]
  },
  {
    "name": "snowman",
    "file": "snowman.gif",
    "title": "Snowman",
    "category": "nature",
    "shortcode": ":snowman:",
    "aliases": [
      "\u26c4"
    ]
  },
  {
    "name": "soccer_ball",
    "file": "soccer_ball.gif",
    "title": "Soccer Ball",
    "category": "activity",
    "shortcode": ":soccer_ball:",
    "aliases": [
      "\u26bd",
      ":soccer:"
    ]
  },
  {
    "name": "sparkles",
    "file": "sparkles.gif",
    "title": "Sparkles",
    "category": "symbols",
    "shortcode": ":sparkles:",
    "aliases": [
      "\u2728"
    ]
  },
  {
    "name": "sparkling_heart",
    "file": "sparkling_heart.gif",
    "title": "Sparkling Heart",
    "category": "symbols",
    "shortcode": ":sparkling_heart:",
    "aliases": [
      "\u2764\ufe0f",
      "\ud83d\udc96",
      ":heart:"
    ]
  },
  {
    "name": "speak_no_evil_monkey",
    "file": "speak_no_evil_monkey.gif",
    "title": "Speak No Evil Monkey",
    "category": "nature",
    "shortcode": ":speak_no_evil_monkey:",
    "aliases": []
  },
  {
    "name": "sport_utility_vehicle",
    "file": "sport_utility_vehicle.gif",
    "title": "Sport Utility Vehicle",
    "category": "activity",
    "shortcode": ":sport_utility_vehicle:",
    "aliases": []
  },
  {
    "name": "spouting_whale",
    "file": "spouting_whale.gif",
    "title": "Spouting Whale",
    "category": "faces",
    "shortcode": ":spouting_whale:",
    "aliases": [
      "\ud83d\udc33",
      ":whale:"
    ]
  },
  {
    "name": "star_struck",
    "file": "star_struck.gif",
    "title": "Star Struck",
    "category": "faces",
    "shortcode": ":star_struck:",
    "aliases": [
      "\ud83e\udd29",
      ":starstruck:"
    ]
  },
  {
    "name": "sun",
    "file": "sun.gif",
    "title": "Sun",
    "category": "nature",
    "shortcode": ":sun:",
    "aliases": [
      "\u2600\ufe0f"
    ]
  },
  {
    "name": "sunrise",
    "file": "sunrise.gif",
    "title": "Sunrise",
    "category": "nature",
    "shortcode": ":sunrise:",
    "aliases": [
      "\ud83c\udf05"
    ]
  },
  {
    "name": "teddy_bear",
    "file": "teddy_bear.gif",
    "title": "Teddy Bear",
    "category": "nature",
    "shortcode": ":teddy_bear:",
    "aliases": [
      "\ud83e\uddf8",
      ":teddy:"
    ]
  },
  {
    "name": "thinking_face",
    "file": "thinking_face.gif",
    "title": "Thinking Face",
    "category": "faces",
    "shortcode": ":thinking_face:",
    "aliases": [
      "\ud83e\udd14",
      ":think:"
    ]
  },
  {
    "name": "thought_balloon",
    "file": "thought_balloon.gif",
    "title": "Thought Balloon",
    "category": "activity",
    "shortcode": ":thought_balloon:",
    "aliases": [
      "\ud83d\udcad"
    ]
  },
  {
    "name": "thumbs_down",
    "file": "thumbs_down.gif",
    "title": "Thumbs Down",
    "category": "people",
    "shortcode": ":thumbs_down:",
    "aliases": [
      "\ud83d\udc4e",
      ":thumbsdown:",
      ":-1:"
    ]
  },
  {
    "name": "thumbs_up",
    "file": "thumbs_up.gif",
    "title": "Thumbs Up",
    "category": "people",
    "shortcode": ":thumbs_up:",
    "aliases": [
      "\ud83d\udc4d",
      ":thumbsup:",
      ":+1:"
    ]
  },
  {
    "name": "tornado",
    "file": "tornado.gif",
    "title": "Tornado",
    "category": "nature",
    "shortcode": ":tornado:",
    "aliases": [
      "\ud83c\udf2a\ufe0f"
    ]
  },
  {
    "name": "trophy",
    "file": "trophy.gif",
    "title": "Trophy",
    "category": "symbols",
    "shortcode": ":trophy:",
    "aliases": [
      "\ud83c\udfc6"
    ]
  },
  {
    "name": "umbrella_with_rain_drops",
    "file": "umbrella_with_rain_drops.gif",
    "title": "Umbrella With Rain Drops",
    "category": "nature",
    "shortcode": ":umbrella_with_rain_drops:",
    "aliases": [
      "\u2614"
    ]
  },
  {
    "name": "unamused_face",
    "file": "unamused_face.gif",
    "title": "Unamused Face",
    "category": "faces",
    "shortcode": ":unamused_face:",
    "aliases": [
      "\ud83d\ude12",
      ":unamused:"
    ]
  },
  {
    "name": "unicorn",
    "file": "unicorn.gif",
    "title": "Unicorn",
    "category": "nature",
    "shortcode": ":unicorn:",
    "aliases": [
      "\ud83e\udd84"
    ]
  },
  {
    "name": "upside_down_face",
    "file": "upside_down_face.gif",
    "title": "Upside Down Face",
    "category": "faces",
    "shortcode": ":upside_down_face:",
    "aliases": [
      "\ud83d\ude43",
      ":upside_down:"
    ]
  },
  {
    "name": "violin",
    "file": "violin.gif",
    "title": "Violin",
    "category": "symbols",
    "shortcode": ":violin:",
    "aliases": [
      "\ud83c\udfbb"
    ]
  },
  {
    "name": "volcano",
    "file": "volcano.gif",
    "title": "Volcano",
    "category": "nature",
    "shortcode": ":volcano:",
    "aliases": [
      "\ud83c\udf0b"
    ]
  },
  {
    "name": "warning",
    "file": "warning.gif",
    "title": "Warning",
    "category": "symbols",
    "shortcode": ":warning:",
    "aliases": [
      "\u26a0\ufe0f"
    ]
  },
  {
    "name": "waving_hand",
    "file": "waving_hand.gif",
    "title": "Waving Hand",
    "category": "people",
    "shortcode": ":waving_hand:",
    "aliases": [
      "\ud83d\udc4b",
      ":wave:"
    ]
  },
  {
    "name": "weary_face",
    "file": "weary_face.gif",
    "title": "Weary Face",
    "category": "faces",
    "shortcode": ":weary_face:",
    "aliases": [
      "\ud83d\ude29",
      "\ud83d\ude2b",
      ":weary:"
    ]
  },
  {
    "name": "winking_face",
    "file": "winking_face.gif",
    "title": "Winking Face",
    "category": "faces",
    "shortcode": ":winking_face:",
    "aliases": [
      "\ud83d\ude09",
      ":wink:"
    ]
  },
  {
    "name": "winking_face_with_tongue",
    "file": "winking_face_with_tongue.gif",
    "title": "Winking Face With Tongue",
    "category": "faces",
    "shortcode": ":winking_face_with_tongue:",
    "aliases": [
      "\ud83d\ude1c",
      ":tongue:"
    ]
  },
  {
    "name": "woman_biking",
    "file": "woman_biking.gif",
    "title": "Woman Biking",
    "category": "people",
    "shortcode": ":woman_biking:",
    "aliases": []
  },
  {
    "name": "woman_dancing",
    "file": "woman_dancing.gif",
    "title": "Woman Dancing",
    "category": "people",
    "shortcode": ":woman_dancing:",
    "aliases": []
  },
  {
    "name": "woman_facepalming",
    "file": "woman_facepalming.gif",
    "title": "Woman Facepalming",
    "category": "faces",
    "shortcode": ":woman_facepalming:",
    "aliases": []
  },
  {
    "name": "woman_fairy",
    "file": "woman_fairy.gif",
    "title": "Woman Fairy",
    "category": "people",
    "shortcode": ":woman_fairy:",
    "aliases": []
  },
  {
    "name": "woman_juggling",
    "file": "woman_juggling.gif",
    "title": "Woman Juggling",
    "category": "people",
    "shortcode": ":woman_juggling:",
    "aliases": []
  },
  {
    "name": "woman_raising_hand",
    "file": "woman_raising_hand.gif",
    "title": "Woman Raising Hand",
    "category": "people",
    "shortcode": ":woman_raising_hand:",
    "aliases": []
  },
  {
    "name": "woman_running",
    "file": "woman_running.gif",
    "title": "Woman Running",
    "category": "people",
    "shortcode": ":woman_running:",
    "aliases": []
  },
  {
    "name": "woman_shrugging",
    "file": "woman_shrugging.gif",
    "title": "Woman Shrugging",
    "category": "people",
    "shortcode": ":woman_shrugging:",
    "aliases": []
  },
  {
    "name": "woman_tipping_hand",
    "file": "woman_tipping_hand.gif",
    "title": "Woman Tipping Hand",
    "category": "people",
    "shortcode": ":woman_tipping_hand:",
    "aliases": []
  },
  {
    "name": "woman_zombie",
    "file": "woman_zombie.gif",
    "title": "Woman Zombie",
    "category": "people",
    "shortcode": ":woman_zombie:",
    "aliases": []
  },
  {
    "name": "women_with_bunny_ears",
    "file": "women_with_bunny_ears.gif",
    "title": "Women With Bunny Ears",
    "category": "people",
    "shortcode": ":women_with_bunny_ears:",
    "aliases": []
  },
  {
    "name": "woozy_face",
    "file": "woozy_face.gif",
    "title": "Woozy Face",
    "category": "faces",
    "shortcode": ":woozy_face:",
    "aliases": [
      "\ud83e\udd74",
      ":woozy:"
    ]
  },
  {
    "name": "writing_hand",
    "file": "writing_hand.gif",
    "title": "Writing Hand",
    "category": "people",
    "shortcode": ":writing_hand:",
    "aliases": [
      "\u270d\ufe0f"
    ]
  },
  {
    "name": "yawning_face",
    "file": "yawning_face.gif",
    "title": "Yawning Face",
    "category": "faces",
    "shortcode": ":yawning_face:",
    "aliases": [
      "\ud83e\udd71",
      ":yawn:"
    ]
  },
  {
    "name": "zany_face",
    "file": "zany_face.gif",
    "title": "Zany Face",
    "category": "faces",
    "shortcode": ":zany_face:",
    "aliases": [
      "\ud83e\udd2a",
      ":zany:"
    ]
  },
  {
    "name": "zipper_mouth_face",
    "file": "zipper_mouth_face.gif",
    "title": "Zipper Mouth Face",
    "category": "faces",
    "shortcode": ":zipper_mouth_face:",
    "aliases": [
      "\ud83e\udd10",
      ":zipper:"
    ]
  },
  {
    "name": "zombie",
    "file": "zombie.gif",
    "title": "Zombie",
    "category": "people",
    "shortcode": ":zombie:",
    "aliases": [
      "\ud83e\udddf"
    ]
  }
];

  // Map of all shortcodes & aliases -> filename
  const SHORTCODE_TO_FILE = {};
  // Map of Unicode emojis -> filename
  const EMOJI_TO_FILE = {};

  EMOTICONS_LIST.forEach(item => {
    SHORTCODE_TO_FILE[':' + item.name + ':'] = item.file;
    if (Array.isArray(item.aliases)) {
      item.aliases.forEach(alias => {
        if (alias.startsWith(':') && alias.endsWith(':')) {
          SHORTCODE_TO_FILE[alias] = item.file;
        } else {
          EMOJI_TO_FILE[alias] = item.file;
        }
      });
    }
  });

  // Sorted emoji keys by length descending to match composite emojis first
  const SORTED_EMOJIS = Object.keys(EMOJI_TO_FILE).sort((a, b) => b.length - a.length);

  // Parse HTML string and replace shortcodes & emojis with <img class="chat-emoticon">
  function parseEmoticonsHtml(text) {
    if (typeof text !== 'string' || !text) return text;

    let res = text;

    // 1. Replace shortcodes like :butterfly: or :face_with_tears_of_joy:
    res = res.replace(/:([a-z0-9_+\-]+):/gi, (match) => {
      const lower = match.toLowerCase();
      const file = SHORTCODE_TO_FILE[lower];
      if (file) {
        const title = lower.slice(1, -1).replace(/_/g, ' ');
        return `<img src="img/emoticons/${file}" class="chat-emoticon" alt="${match}" data-code="${match}" title="${title} (${match}) — Click to paste" />`;
      }
      return match;
    });

    // 2. Split by HTML tags so we only replace emojis inside plain text nodes
    const parts = res.split(/(<[^>]+>)/g);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] && !parts[i].startsWith('<')) {
        let p = parts[i];
        for (const em of SORTED_EMOJIS) {
          if (p.includes(em)) {
            const file = EMOJI_TO_FILE[em];
            const name = file.replace('.gif', '');
            const shortcode = `:${name}:`;
            const title = name.replace(/_/g, ' ');
            const imgTag = `<img src="img/emoticons/${file}" class="chat-emoticon" alt="${shortcode}" data-code="${shortcode}" title="${title} (${shortcode}) — Click to paste" />`;
            p = p.split(em).join(imgTag);
          }
        }
        parts[i] = p;
      }
    }

    return parts.join('');
  }

  // Instant preloader: Pre-cache all 199 animated GIF emoticons into browser memory for 0ms latency
  function preloadAllEmoticons() {
    try {
      const cache = [];
      for (let i = 0; i < EMOTICONS_LIST.length; i++) {
        const img = new Image();
        img.src = 'img/emoticons/' + EMOTICONS_LIST[i].file;
        cache.push(img);
      }
      window._cachedEmoticonImages = cache;
    } catch (_) {}
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', preloadAllEmoticons);
    } else if (typeof setTimeout !== 'undefined') {
      setTimeout(preloadAllEmoticons, 10);
    } else {
      preloadAllEmoticons();
    }
  }

  window.ChatEmoticons = {
    LIST: EMOTICONS_LIST,
    SHORTCODE_TO_FILE,
    EMOJI_TO_FILE,
    parseEmoticonsHtml,
    preloadAllEmoticons
  };

})(window);
