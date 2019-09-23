var assert = require("assert");
var crypto = require("crypto");
var fs = require("fs");
var hashUtils = require("../script/hash-utils");
var mkdirp = require("mkdirp");
var os = require("os");
var path = require("path");
var q = require("q");
var yauzl = require("yauzl");
function randomString() {
    var stringLength = 10;
    return crypto.randomBytes(Math.ceil(stringLength / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, stringLength); // return required number of characters
}
function unzipToDirectory(zipPath, directoryPath) {
    var deferred = q.defer();
    var originalCwd = process.cwd();
    mkdirp(directoryPath, function (err) {
        if (err)
            throw err;
        process.chdir(directoryPath);
        yauzl.open(zipPath, { lazyEntries: true }, function (err, zipfile) {
            if (err)
                throw err;
            zipfile.readEntry();
            zipfile.on("entry", function (entry) {
                if (/\/$/.test(entry.fileName)) {
                    // directory file names end with '/'
                    mkdirp(entry.fileName, function (err) {
                        if (err)
                            throw err;
                        zipfile.readEntry();
                    });
                }
                else {
                    // file entry
                    zipfile.openReadStream(entry, function (err, readStream) {
                        if (err)
                            throw err;
                        // ensure parent directory exists
                        mkdirp(path.dirname(entry.fileName), function (err) {
                            if (err)
                                throw err;
                            readStream.pipe(fs.createWriteStream(entry.fileName));
                            readStream.on("end", function () {
                                zipfile.readEntry();
                            });
                        });
                    });
                }
            });
            zipfile.on("end", function (err) {
                if (err)
                    deferred.reject(err);
                else
                    deferred.resolve(null);
            });
        });
    });
    return deferred.promise
        .finally(function () {
        process.chdir(originalCwd);
    });
}
describe("Hashing utility", function () {
    var TEST_DIRECTORY = path.join(os.tmpdir(), "codepushtests", randomString());
    var TEST_ARCHIVE_FILE_PATH = path.join(__dirname, "resources", "test.zip");
    var TEST_ZIP_HASH = "540fed8df3553079e81d1353c5cc4e3cac7db9aea647a85d550f646e8620c317";
    var TEST_ZIP_MANIFEST_HASH = "9e0499ce7df5c04cb304c9deed684dc137fc603cb484a5b027478143c595d80b";
    var HASH_B = "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d";
    var HASH_C = "2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6";
    var HASH_D = "18ac3e7343f016890c510e93f935261169d9e3f565436429830faf0934f4f8e4";
    var IGNORED_METADATA_ARCHIVE_FILE_PATH = path.join(__dirname, "resources", "ignoredMetadata.zip");
    var INDEX_HASH = "b0693dc92f76e08bf1485b3dd9b514a2e31dfd6f39422a6b60edb722671dc98f";
    it("generates a package hash from file", function (done) {
        hashUtils.hashFile(TEST_ARCHIVE_FILE_PATH)
            .done(function (packageHash) {
            assert.equal(packageHash, TEST_ZIP_HASH);
            done();
        });
    });
    it("generates a package manifest for an archive", function (done) {
        hashUtils.generatePackageManifestFromZip(TEST_ARCHIVE_FILE_PATH)
            .done(function (manifest) {
            var fileHashesMap = manifest.toMap();
            assert.equal(fileHashesMap.size, 3);
            var hash = fileHashesMap.get("b.txt");
            assert.equal(hash, HASH_B);
            hash = fileHashesMap.get("c.txt");
            assert.equal(hash, HASH_C);
            hash = fileHashesMap.get("d.txt");
            assert.equal(hash, HASH_D);
            done();
        });
    });
    it("generates a package manifest for a directory", function (done) {
        var directory = path.join(TEST_DIRECTORY, "testZip");
        unzipToDirectory(TEST_ARCHIVE_FILE_PATH, directory)
            .then(function () {
            return hashUtils.generatePackageManifestFromDirectory(directory, directory);
        })
            .done(function (manifest) {
            var fileHashesMap = manifest.toMap();
            assert.equal(fileHashesMap.size, 3);
            var hash = fileHashesMap.get("b.txt");
            assert.equal(hash, HASH_B);
            hash = fileHashesMap.get("c.txt");
            assert.equal(hash, HASH_C);
            hash = fileHashesMap.get("d.txt");
            assert.equal(hash, HASH_D);
            done();
        });
    });
    it("generates a package hash from manifest", function (done) {
        hashUtils.generatePackageManifestFromZip(TEST_ARCHIVE_FILE_PATH)
            .then(function (manifest) {
            return manifest.computePackageHash();
        })
            .done(function (packageHash) {
            assert.equal(packageHash, TEST_ZIP_MANIFEST_HASH);
            done();
        });
    });
    it("generates a package manifest for an archive with ignorable metadata", function (done) {
        hashUtils.generatePackageManifestFromZip(IGNORED_METADATA_ARCHIVE_FILE_PATH)
            .done(function (manifest) {
            assert.equal(manifest.toMap().size, 1);
            var hash = manifest.toMap().get("www/index.html");
            assert.equal(hash, INDEX_HASH);
            done();
        });
    });
    it("generates a package manifest for a directory with ignorable metadata", function (done) {
        var directory = path.join(TEST_DIRECTORY, "ignorableMetadata");
        unzipToDirectory(IGNORED_METADATA_ARCHIVE_FILE_PATH, directory)
            .then(function () {
            return hashUtils.generatePackageManifestFromDirectory(directory, directory);
        })
            .done(function (manifest) {
            assert.equal(manifest.toMap().size, 1);
            var hash = manifest.toMap().get("www/index.html");
            assert.equal(hash, INDEX_HASH);
            done();
        });
    });
});

//# sourceMappingURL=hash-utils.js.map
