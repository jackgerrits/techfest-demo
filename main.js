let states =
{
  greeting: {
    action: async (context) => {
      let response = "Hi, welcome. Would you like to see what's available or get a coffee recommendation?";
      return { response, context };
    },
    transitions: [
      {
        text: "Show me the menu",
        next_state: "menu"
      },
      {
        text: "What should I get?",
        next_state: "recommend"
      }
    ]
  },
  menu: {
    action: async (context) => {
      let response = getCoffeeList(coffees).join(", ");
      return { response, context };
    },
    transitions: [
      {
        text: "What should I get?",
        next_state: "recommend"
      }
    ]
  },
  recommend: {
    action: async (context) => {
      let features = context.userFeatureProvider.generateContextFeatures(context.featureData);
      let temp = await rank(features);

      let response = `Why don't you try a ${temp.response.rewardActionId}?`;
      let debug = {};
      debug.response = temp.response;
      debug.context = temp.context;

      // Set the state object for the last event id to be used for rewards.
      context.lastEventId = temp.response.eventId;

      return { response, context, debug_type: "rank", debug };
    },
    transitions: [
      {
        text: "Sounds good",
        next_state: "like"
      },
      {
        text: "Eh",
        next_state: "dislike"
      },
      {
        text: "Show me the menu",
        next_state: "menu"
      }
    ]
  },
  like: {
    action: async (context) => {
      let temp = await reward(context.lastEventId, 1.0);
      let debug = {};
      debug.response = temp.response;
      debug.context = temp.context;
      let response = "That's great! I'll keep learning your preferences over time.";
      return { response, context, debug_type: "reward", debug };
    },
    transitions: [
      {
        text: "Give me another recommendation",
        next_state: "recommend"
      },
      {
        text: "Show me the menu",
        next_state: "menu"
      }
    ]
  },
  dislike: {
    action: async (context) => {
      let temp = await reward(context.lastEventId, -1.0);
      let debug = {};
      debug.response = temp.response;
      debug.context = temp.context;
      let response = "Okay I'll remember that, would you like another recomendation?";
      return { response, context, debug_type: "reward", debug };
    },
    transitions: [
      {
        text: "Sure",
        next_state: "recommend"
      },
      {
        text: "Actually, show me the menu",
        next_state: "menu"
      }
    ]
  }
}

function getCoffeeList(coffeeData) {
  return coffeeData.map((x) => x.id);
}

class UserFeatureProvider {
  constructor() {
    this.providers = [];
  }

  addProvider(provider) {
    this.providers.push(provider);
  }

  generateContextFeatures(data) {
    let returnObject = [];
    for (let prov of this.providers) {
      returnObject.push(prov(data));
    }
    return returnObject;
  }
};

async function rank(contextFeatures) {
  let context = {};
  context.contextFeatures = contextFeatures;
  context.actions = coffees;
  context.excludeActions = null;
  context.activated = true;

  let response = await fetch("https://westus2.api.cognitive.microsoft.com/personalization/v1.0/rank", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Ocp-Apim-Subscription-Key": COG_SVC_KEY
    },
    method: "POST",
    body: JSON.stringify(context)
  });

  let result = {};
  result.response = await response.json();
  result.context = context;
  return result;
}

async function weather(lat, long) {
  let response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${long}&appid=${OPEN_WEATHER_MAP_KEY}`);
  return await response.json();
}

async function reward(eventId, value) {
  let context = {};
  context.value = value;

  let response = await fetch(`https://westus2.api.cognitive.microsoft.com/personalization/v1.0/events/${eventId}/reward`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Ocp-Apim-Subscription-Key": COG_SVC_KEY
    },
    method: "POST",
    body: JSON.stringify(context)
  });

  let result = {};
  result.response = response;
  result.context = context;
  return result;
}

function add_button(parent, text, callback) {
  let element = document.createElement("button");
  element.classList.add("btn", "choice-btn");
  element.innerHTML = text;
  element.onclick = callback(element);
  parent.appendChild(element);
  return element;
}

function clear_buttons(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}

function append_message(parent, text) {
  parent.innerHTML += `${text} <br>`;
}

function append_message_bold(parent, text) {
  parent.innerHTML += `<b>${text}</b> <br>`;
}

function append_user_message(parent, text) {
  let outer = document.createElement("div");
  outer.className = "col-lg-12";
  let inner = document.createElement("div");
  inner.classList.add("speech-bubble-user", "speech-bubble");
  outer.appendChild(inner);

  let textElem = document.createElement("div");
  textElem.className = "speech-bubble-text";
  textElem.innerHTML = text;
  inner.appendChild(textElem);

  parent.appendChild(outer);
}

function append_bot_message(parent, text, transitions, states, context) {
  let outer = document.createElement("div");
  outer.className = "col-lg-12";
  let inner = document.createElement("div");
  inner.classList.add("speech-bubble-bot", "speech-bubble");
  outer.appendChild(inner);

  let textElem = document.createElement("div");
  textElem.className = "speech-bubble-text";
  textElem.innerHTML = text;
  inner.appendChild(textElem);

  parent.appendChild(outer);
  return inner;
}

function getCurrentLocation(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, ({code, message}) =>
      reject(Object.assign(new Error(message), {name: "PositionError", code})),
      options);
    });
};

function repeatEvery(interval, func) {
  // Check current time and calculate the delay until next interval
  var now = new Date(),
      delay = interval - now % interval;

  function start() {
      // Execute function now...
      func();
      // ... and every interval
      setInterval(func, interval);
  }

  // Delay execution until it's an even interval
  setTimeout(start, delay);
}

var ONE_MINUTE = 60 * 1000;

function formatAMPM(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0'+minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return strTime;
}

window.onload = async () => {
  renderjson.set_icons("+", "-");
  renderjson.set_show_to_level(1);

  let outputLog = document.getElementById("message");
  let buttons = document.getElementById("buttons");
  let diagLog = document.getElementById("diagInfo");

  let info_time = document.getElementById("info-time");
  let info_location = document.getElementById("info-location");
  let info_weather = document.getElementById("info-weather");
  let chat_container = document.getElementById("chat-container");
  let typing_indicator = document.getElementById("typing-indicator");

  info_time.innerHTML = formatAMPM(new Date);
  repeatEvery(ONE_MINUTE, () => {
    info_time.innerHTML = formatAMPM(new Date);
  });


  let start_state = states.greeting;

  let context_transitions = {};
  context_transitions.lastEventId = "";
  context_transitions.featureData = {};

  let location = undefined;
  try {
    location = await getCurrentLocation();
  }
  catch(ex) {
    console.error("Location not available, location features turned off.");
    console.error(ex)
  }

  if(location !== undefined)
  {
    context_transitions.featureData.location = location;
    context_transitions.featureData.weather = await weather(location.coords.latitude, location.coords.longitude);
    info_location.innerHTML = context_transitions.featureData.weather.name;
    info_weather.innerHTML = context_transitions.featureData.weather.weather[0].main;
  }

  let userFeatureProvider = new UserFeatureProvider();
  userFeatureProvider.addProvider(data => {
    return { "day": data.date.getDay() }
  });

  userFeatureProvider.addProvider(data => {
    let hour = data.date.getHours();
    let time;
    if(hour < 7 || hour > 19)
    {
      time = "night";
    } else if (hour >= 7 || hour < 12) {
      time = "morning";
    } else {
      time = "afternoon";
    }

    return { "timeOfDay": time }
  });

  // Location is required for weather, city, season, temperature
  if(location !== undefined) {
    userFeatureProvider.addProvider(data => {
      return { "city": data.weather.name }
    });

    userFeatureProvider.addProvider(data => {
      return { "temperature": data.weather.main.temp }
    });

    userFeatureProvider.addProvider(data => {
      return { "weather": data.weather.weather[0].main }
    });

    userFeatureProvider.addProvider(data => {
      let month = data.date.getMonth();

      // If in southern hemisphere offset months by 6 to get correct season.
      if(data.location.coords.latitude < 0)
      {
        month = (month + 6) % 12;
      }

      let season = "";
      switch(month) {
        case 12:
        case 1:
        case 2:
            season = "winter";
        break;
        case 3:
        case 4:
        case 5:
            season = "spring";
        break;
        case 6:
        case 7:
        case 8:
            season = "summer";
        break;
        case 9:
        case 10:
        case 11:
            season = "fall";
        break;
      }
      return { "season": season };
    });

  }

  context_transitions.userFeatureProvider = userFeatureProvider;
  context_transitions.featureData.date = new Date();

  const go_to_state = async (current_state, state_context) => {
    // clear_buttons(buttons);

    let result = await current_state.action(state_context);
    // chat_container.removeChild(typing_indicator);
    let button_container = append_bot_message(chat_container, result.response,current_state.transitions);
    let buttons = [];
    for (let action of current_state.transitions) {
      buttons.push(add_button(button_container, action.text, (self) => {
        return () => {
          // chat_container.appendChild(typing_indicator);
          buttons.forEach(button => button.disabled = true);
          self.classList.add("selected");
          // TODO disable buttons
          append_user_message(chat_container, action.text);
          go_to_state(states[action.next_state], result.context)
        }
      }));
    }
    // (outputLog, result.response);

    // if (result.hasOwnProperty("debug_type")) {
    //   if (result.debug_type == "rank") {
    //     diagLog.appendChild(document.createTextNode("context sent:"));
    //     diagLog.appendChild(renderjson(result.debug.context));
    //     diagLog.appendChild(document.createTextNode("response received:"));
    //     diagLog.appendChild(renderjson(result.debug.response));
    //   }
    //   else if (result.debug_type == "reward") {
    //     diagLog.appendChild(document.createTextNode("reward sent:"));
    //     diagLog.appendChild(renderjson(result.debug.context));
    //   }
    //   diagLog.appendChild(document.createElement("hr"));
    // }

    // for (let action of current_state.transitions) {
    //   add_button(buttons, action.text, () => {
    //     append_message(outputLog, action.text);
    //     go_to_state(states[action.next_state], result.context)
    //   });
    // }
  }

  go_to_state(start_state, context_transitions);
};
