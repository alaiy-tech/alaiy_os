import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Alaiy OS",
  version: packageJson.version,
  copyright: `© ${currentYear}, Alaiy OS.`,
  meta: {
    title: "Alaiy OS",
    description: "Alaiy OS",
  },
};
