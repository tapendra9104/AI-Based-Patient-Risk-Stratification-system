from __future__ import annotations

from flask import Flask
from flask_cors import CORS

from .config import Settings
from .extensions import db
from .http_utils import register_http_handlers
from .routes import api_bp
from .security import validate_security_config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_mapping(Settings.as_dict())
    validate_security_config(app.config)

    allowed_origins = app.config.get("ALLOWED_ORIGINS", ["http://127.0.0.1:5500"])
    cors_origins = "*" if allowed_origins == ["*"] else allowed_origins
    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        expose_headers=["X-Request-ID"],
    )
    register_http_handlers(app)

    db.init_app(app)
    with app.app_context():
        db.create_all()

    app.register_blueprint(api_bp)
    return app
