// Words for the parent screens, in English ("en") and Hindi ("hi").
//   t(lang, "key", {name: "x"})  -> a label from the UI dictionary below ({name} gets replaced)
//   eventText(lang, event)       -> kicker / heading / body / timeline text for one ParentEvent
// The server only sends an event KIND + small params (names, numbers). The words live here.
import type { ParentEvent } from "./types";

export type Lang = "en" | "hi";

type Vars = Record<string, string | number>;

// ---------- UI labels ----------
const UI: Record<Lang, Record<string, string>> = {
  en: {
    trip_morning: "Morning trip",
    trip_afternoon: "Afternoon trip",
    sound_title: "Turn on alarm sound",
    sound_why: "One tap lets your phone ring loudly and show alerts when the bus is near or your child needs you.",
    sound_btn: "Turn on",
    class: "Class",
    tag: "Tag",
    bus: "Bus",
    home_stop: "Home stop",
    status: "Status",
    arrives: "Arrives",
    last_scan: "Last scan",
    st_waiting: "Waiting at stop",
    st_atschool: "In school",
    st_onboard: "On board",
    st_dropped: "Dropped",
    st_missed: "Missed bus",
    st_none: "No trip yet",
    eta_line: "{bus} · {dist} away · ~{min} min",
    eta_passed: "{bus} · passed your stop",
    eta_school: "{bus} · {dist} to school · ~{min} min",
    eta_none: "{bus} · No trip running",
    alert_within: "Alert me when the bus is within:",
    approx: "≈ {n} min",
    near_is: "Bus is near:",
    alarm: "Alarm",
    notification: "Notification",
    red_note: "Red alerts always ring.",
    today: "Today",
    timeline_empty: "Today's updates will appear here.",
    loading: "Loading…",
    change_stop: "Change my stop",
    close: "Close",
    tap_map: "Tap the map to drop a pin near your new home.",
    pin_not_saved: "Your pin is not saved, only the chosen stop.",
    nearest: "Nearest stops",
    seats_free: "{n} seats free",
    full: "Full",
    start_date: "Starts on",
    send_request: "Send request",
    request_sent: "Request sent to the transport desk",
    ok: "OK",
    im_going: "I'm going",
    dismiss: "Dismiss",
    not_going: "{child} is not going today",
    i_drop: "I'll drop {child} myself",
    call_attendant: "Call attendant (number hidden)",
    call_school: "Call school (number hidden)",
    call_toast: "Masked call placed, no number shared",
    incoming: "SafeRide alert",
  },
  hi: {
    trip_morning: "सुबह की ट्रिप",
    trip_afternoon: "दोपहर की ट्रिप",
    sound_title: "अलार्म की आवाज़ चालू करें",
    sound_why: "एक टैप से बस पास आने पर या बच्चे को आपकी ज़रूरत होने पर फ़ोन तेज़ बजेगा और सूचना दिखेगी।",
    sound_btn: "चालू करें",
    class: "कक्षा",
    tag: "टैग",
    bus: "बस",
    home_stop: "घर का स्टॉप",
    status: "स्थिति",
    arrives: "पहुँचेगी",
    last_scan: "आख़िरी स्कैन",
    st_waiting: "स्टॉप पर इंतज़ार",
    st_atschool: "स्कूल में",
    st_onboard: "बस में",
    st_dropped: "उतारा गया",
    st_missed: "बस छूटी",
    st_none: "अभी कोई ट्रिप नहीं",
    eta_line: "{bus} · {dist} दूर · ~{min} मिनट",
    eta_passed: "{bus} · आपका स्टॉप निकल चुकी",
    eta_school: "{bus} · स्कूल {dist} दूर · ~{min} मिनट",
    eta_none: "{bus} · कोई ट्रिप नहीं चल रही",
    alert_within: "बस इतनी दूरी पर आए तो बताएँ:",
    approx: "≈ {n} मिनट",
    near_is: "बस पास आए तो:",
    alarm: "अलार्म",
    notification: "सूचना",
    red_note: "लाल अलर्ट हमेशा बजेंगे।",
    today: "आज",
    timeline_empty: "आज की सूचनाएँ यहाँ दिखेंगी।",
    loading: "लोड हो रहा है…",
    change_stop: "मेरा स्टॉप बदलें",
    close: "बंद करें",
    tap_map: "नए घर के पास मैप पर टैप करके पिन लगाइए।",
    pin_not_saved: "आपका पिन सेव नहीं होता, सिर्फ़ चुना हुआ स्टॉप जाता है।",
    nearest: "सबसे पास के स्टॉप",
    seats_free: "{n} सीटें ख़ाली",
    full: "भरी हुई",
    start_date: "शुरू होने की तारीख़",
    send_request: "अनुरोध भेजें",
    request_sent: "अनुरोध ट्रांसपोर्ट डेस्क को भेज दिया गया",
    ok: "ठीक है",
    im_going: "मैं जा रहा हूँ",
    dismiss: "बंद करें",
    not_going: "{child} आज नहीं जा रहे",
    i_drop: "मैं {child} को ख़ुद छोड़ दूँगा",
    call_attendant: "अटेंडेंट को कॉल करें (नंबर छिपा)",
    call_school: "स्कूल को कॉल करें (नंबर छिपा)",
    call_toast: "छिपे नंबर से कॉल लगाई गई, कोई नंबर साझा नहीं हुआ",
    incoming: "सेफ़राइड अलर्ट",
  },
};

// Replace {name} placeholders in a string.
function fill(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? "" : String(vars[k])));
}

export function t(lang: Lang, key: string, vars?: Vars): string {
  return fill(UI[lang][key] ?? UI.en[key] ?? key, vars);
}

// ---------- helpers ----------
// 600 -> "600 m", 1200 -> "1.2 km", 1000 -> "1 km"
export function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace(/\.0$/, "")} km`;
}

// The server sends "Bus 4"; show "बस 4" in Hindi.
function busName(lang: Lang, bus: unknown): string {
  const num = String(bus ?? "").replace(/^bus\s*/i, "");
  return `${lang === "hi" ? "बस" : "Bus"} ${num}`.trim();
}

function isMorning(v: unknown) {
  return v === true || v === "true" || v === 1;
}

// ---------- event texts ----------
export interface EventText {
  kicker: string; // small uppercase line
  heading: string; // big line
  body: string;
  timeline: string; // one short line for the day timeline
}

export function eventText(lang: Lang, e: ParentEvent): EventText {
  const p = e.params;
  const hi = lang === "hi";
  const bus = busName(lang, p.bus);
  const child = String(p.child ?? "");
  const stop = String(p.stop ?? "");
  const home = String(p.home ?? "");
  const time = String(p.time ?? e.simTimeText);
  const dist = fmtDist(Number(p.distM ?? 0));
  const min = Number(p.minutes ?? 0);
  const morning = isMorning(p.morning);

  switch (e.kind) {
    case "near":
      if (hi) {
        return {
          kicker: "बस पास है",
          heading: morning ? "अभी स्टॉप पर जाइए" : "स्टॉप पर पहुँचिए",
          body: morning
            ? `${bus} ${dist} दूर है, लगभग ${min} मिनट। ${child} को भेज दीजिए।`
            : `${child} ${bus} में है, ${stop} से ${dist} दूर, लगभग ${min} मिनट।`,
          timeline: `${bus} ${dist} दूर`,
        };
      }
      return {
        kicker: "Bus is near",
        heading: morning ? "Head to the stop now" : "Be at the stop",
        body: morning
          ? `${bus} is ${dist} away, about ${min} min. Send ${child} out.`
          : `${child} is on ${bus}, ${dist} from ${stop}, about ${min} min.`,
        timeline: `${bus} is ${dist} away`,
      };

    case "arriving":
      if (hi) {
        return {
          kicker: "बस पास है",
          heading: "अभी पहुँच रही है",
          body: morning ? `${bus} ${stop} पहुँच रही है। ${child} को भेजिए।` : `${bus} ${child} के साथ ${stop} पहुँच रही है।`,
          timeline: `${bus} ${stop} पहुँच रही है`,
        };
      }
      return {
        kicker: "Bus is near",
        heading: "Arriving now",
        body: morning ? `${bus} is reaching ${stop}. Send ${child} out.` : `${bus} is reaching ${stop} with ${child}.`,
        timeline: `${bus} arriving at ${stop}`,
      };

    case "boarded":
      return hi
        ? {
            kicker: "बस में चढ़ना",
            heading: `${child} बस में हैं`,
            body: `${child} को ${stop} पर ${bus} में बिठाया गया, ${time}।`,
            timeline: `${child} ${bus} में चढ़े, ${stop}`,
          }
        : {
            kicker: "Boarded",
            heading: `${child} is on the bus`,
            body: `${child} boarded ${bus} at ${stop}, ${time}`,
            timeline: `${child} boarded ${bus} at ${stop}`,
          };

    case "reached_school":
      return hi
        ? {
            kicker: "स्कूल",
            heading: "स्कूल पहुँच गए",
            body: `${child} ${time} बजे स्कूल पहुँच गए।`,
            timeline: `${child} स्कूल पहुँचे`,
          }
        : {
            kicker: "At school",
            heading: "Reached school",
            body: `${child} reached school, ${time}`,
            timeline: `${child} reached school`,
          };

    case "dropped":
      return hi
        ? {
            kicker: "उतारा गया",
            heading: "सुरक्षित उतारा गया",
            body: `${child} को ${time} बजे ${stop} पर उतारा गया।`,
            timeline: `${child} को ${stop} पर उतारा गया`,
          }
        : {
            kicker: "Dropped",
            heading: "Dropped safely",
            body: `${child} was dropped at ${stop}, ${time}`,
            timeline: `${child} dropped at ${stop}`,
          };

    case "missed":
      return hi
        ? {
            kicker: "बस छूट गई",
            heading: "बस छूट गई",
            body: `${bus} ${child} के बिना ${stop} से निकल गई।`,
            timeline: `${child} की बस छूटी (${stop})`,
          }
        : {
            kicker: "Missed the bus",
            heading: "Missed the bus",
            body: `${bus} left ${stop} without ${child}`,
            timeline: `${child} missed ${bus} at ${stop}`,
          };

    case "wrong_stop":
      return hi
        ? {
            kicker: "गलत स्टॉप",
            heading: "गलत स्टॉप पर उतारा",
            body: `${child} को ${home} की जगह ${stop} पर उतारा गया, ${time}।`,
            timeline: `${child} गलत स्टॉप (${stop}) पर उतरे`,
          }
        : {
            kicker: "Wrong stop",
            heading: "Dropped at the wrong stop",
            body: `${child} was dropped at ${stop}, not at ${home}, ${time}`,
            timeline: `${child} dropped at wrong stop (${stop})`,
          };

    case "not_scanned_off":
      return hi
        ? {
            kicker: "ज़रूरी",
            heading: `${child} स्कैन-ऑफ नहीं हुए`,
            body: `जब तक ${child} मिल नहीं जाते, ${bus} अपनी ट्रिप बंद नहीं कर सकती। अटेंडेंट और स्कूल को बता दिया गया है।`,
            timeline: `${child} स्कैन-ऑफ नहीं हुए`,
          }
        : {
            kicker: "Urgent",
            heading: `${child} was not scanned off`,
            body: `${bus} can't close its trip until ${child} is found. The attendant and school have been told.`,
            timeline: `${child} was not scanned off`,
          };

    case "found_safe":
      return hi
        ? {
            kicker: "सुरक्षित",
            heading: `${child} सुरक्षित हैं`,
            body: `${child} ${bus} में ${time} बजे मिले और सुरक्षित हैं।`,
            timeline: `${child} सुरक्षित मिले`,
          }
        : {
            kicker: "All clear",
            heading: `${child} is safe`,
            body: `${child} was found on ${bus} at ${time} and is safe.`,
            timeline: `${child} found safe`,
          };

    case "bag_found": {
      const msg = String(p.message ?? "").trim();
      return hi
        ? {
            kicker: "बैग मिला",
            heading: `किसी को ${child} का बैग मिला`,
            body: msg ? `संदेश: “${msg}”` : "बैग का टैग स्कैन हुआ। आपका नंबर छिपा रहता है।",
            timeline: `${child} का बैग किसी को मिला`,
          }
        : {
            kicker: "Bag found",
            heading: `Someone found ${child}'s bag`,
            body: msg ? `Message: “${msg}”` : "The bag tag was scanned. Your number stays private.",
            timeline: `Someone found ${child}'s bag`,
          };
    }

    case "request_update": {
      const ok = p.status === "approved";
      const change = p.type === "stop_change";
      if (hi) {
        return {
          kicker: "अनुरोध",
          heading: ok ? "अनुरोध मंज़ूर" : "अनुरोध अस्वीकार",
          body: ok ? `${stop} वाला आपका अनुरोध मंज़ूर हो गया।` : `${stop} वाला आपका अनुरोध स्वीकार नहीं हुआ।`,
          timeline: ok ? `${stop} का अनुरोध मंज़ूर` : `${stop} का अनुरोध अस्वीकार`,
        };
      }
      const what = change ? "stop change" : "request";
      return {
        kicker: "Request",
        heading: ok ? "Request approved" : "Request rejected",
        body: ok ? `Your ${what} to ${stop} was approved.` : `Your ${what} to ${stop} was not approved.`,
        timeline: ok ? `Request for ${stop} approved` : `Request for ${stop} rejected`,
      };
    }

    default:
      return { kicker: "", heading: String(e.kind), body: "", timeline: String(e.kind) };
  }
}
