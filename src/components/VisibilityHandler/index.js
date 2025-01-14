import { Component } from 'react';
import { connect } from 'react-redux';
import Obstruction from 'obstruction';
import PropTypes from 'prop-types';
import debounce from 'debounce';

class VisibilityHandler extends Component {
  constructor(props) {
    super(props);

    this.prevVisibleCall = 0;
    this.intervalHandle = null;
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.onVisibilityEvent = debounce(this.onVisibilityEvent.bind(this), 1000, true);
  }

  componentWillMount() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('focus', this.handleFocus);
    document.addEventListener('blur', this.handleBlur);
    this.prevVisibleCall = Date.now() / 1000;
    if (this.props.onInit) {
      this.props.onVisible();
    }
    if (this.props.onInterval) {
      this.intervalHandle = setInterval(this.handleVisibilityChange, this.props.onInterval * 1000);
    }
  }

  componentDidUpdate(prevProps) {
    const { dongleId } = this.props;
    if (this.props.onDongleId && prevProps.dongleId !== dongleId) {
      this.prevVisibleCall = Date.now() / 1000;
      this.props.onVisible();
    }
  }

  componentWillUnmount() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('focus', this.handleFocus);
    document.removeEventListener('blur', this.handleBlur);
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  handleFocus() {
    this.onVisibilityEvent(true);
  }

  handleBlur() {
    this.onVisibilityEvent(false);
  }

  handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      this.onVisibilityEvent(true);
    } else if (document.visibilityState === "hidden") {
      this.onVisibilityEvent(false);
    }
  }

  onVisibilityEvent(visible) {
    const newDate = Date.now() / 1000;
    const dt = newDate - this.prevVisibleCall;
    if (visible && (!this.props.minInterval || dt > this.props.minInterval)) {
      this.prevVisibleCall = newDate;
      this.props.onVisible();
    }

    if (!visible && this.props.resetOnHidden) {
      this.prevVisibleCall = newDate;
    }
  }

  render() {
    return null;
  }
}

const stateToProps = Obstruction({
  dongleId: 'dongleId',
});

VisibilityHandler.propTypes = {
  onVisible: PropTypes.func.isRequired,
  onInit: PropTypes.bool,
  onDongleId: PropTypes.bool,
  onInterval: PropTypes.number,
  minInterval: PropTypes.number, // in seconds, only for visibility changes
  resetOnHidden: PropTypes.bool,
};

export default connect(stateToProps)(VisibilityHandler);
