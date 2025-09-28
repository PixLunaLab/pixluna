use mimetype_detector::detect;

pub fn detect_mime(input: &[u8]) -> String {
    let mt = detect(input);
    mt.to_string()
}
