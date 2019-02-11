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
      let features = context.userFeatureProvider.generateContextFeatures(context.contextFeatures);
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

const Weather = { "Sunny": 0, "Rainy": 1, "Snowy": 2, "Hot": 3 };

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

function chooseRandomEnumKeyFromObject(enumObject) {
  let keys = Object.keys(enumObject);
  return keys[keys.length * Math.random() << 0];
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
  element.innerHTML = text;
  element.onclick = callback;
  parent.appendChild(element);
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

window.onload = async () => {
  renderjson.set_icons("+", "-");
  renderjson.set_show_to_level(1);

  let outputLog = document.getElementById("message");
  let buttons = document.getElementById("buttons");
  let diagLog = document.getElementById("diagInfo");

  let start_state = states.greeting;

  let userFeatureProvider = new UserFeatureProvider();
  userFeatureProvider.addProvider(data => { return { "weather": chooseRandomEnumKeyFromObject(Weather) } });
  userFeatureProvider.addProvider(data => {
    const d = new Date();
    return { "day": d.getDay() }
  });

  let context_transitions = {};
  context_transitions.lastEventId = "";
  context_transitions.featureData = {};
  context_transitions.userFeatureProvider = userFeatureProvider;

  const go_to_state = async (current_state, state_context) => {
    clear_buttons(buttons);

    let result = await current_state.action(state_context);
    append_message_bold(outputLog, result.response);

    if (result.hasOwnProperty("debug_type")) {
      if (result.debug_type == "rank") {
        diagLog.appendChild(document.createTextNode("context sent:"));
        diagLog.appendChild(renderjson(result.debug.context));
        diagLog.appendChild(document.createTextNode("response received:"));
        diagLog.appendChild(renderjson(result.debug.response));
      }
      else if (result.debug_type == "reward") {
        diagLog.appendChild(document.createTextNode("reward sent:"));
        diagLog.appendChild(renderjson(result.debug.context));
      }
      diagLog.appendChild(document.createElement("hr"));
    }

    for (let action of current_state.transitions) {
      add_button(buttons, action.text, () => {
        append_message(outputLog, action.text);
        go_to_state(states[action.next_state], result.context)
      });
    }
  }

  go_to_state(start_state, context_transitions);
};
