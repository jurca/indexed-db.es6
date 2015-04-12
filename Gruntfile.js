module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),

    traceur: {
      options: {
        modules: "amd",
        moduleNames: false,
      },
      build: {
        files: [{
          expand: true,
          cwd: "src",
          src: "**/*.js",
          dest: "dist"
        }]
      }
    },

    watch: {
      options: {
        atBegin: true,
        spawn: false
      },
      scripts: {
        files: ["src/**/*.js"],
        tasks: ["traceur"]
      }
    }
  })

  grunt.loadNpmTasks("grunt-traceur")
  grunt.loadNpmTasks("grunt-contrib-watch")

  grunt.registerTask("default", ["traceur"])
}
